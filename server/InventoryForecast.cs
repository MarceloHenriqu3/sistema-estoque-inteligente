using Microsoft.EntityFrameworkCore;
using Microsoft.ML;
using Microsoft.ML.Data;

public static class InventoryForecast
{
    private static readonly SemaphoreSlim ModelLock = new(1, 1);
    private static CachedModel? globalModel;

    public static async Task<ForecastResult> ForecastDailyOutflowAsync(int productId, InventoryContext db)
    {
        var product = await db.Products.FindAsync(productId);
        if (product == null)
        {
            return new ForecastResult(productId, 0f, 0, 0, "Produto não encontrado", 0);
        }

        var movements = await db.Movements
            .Where(m => m.ProductId == productId && m.QuantityChange < 0)
            .AsNoTracking()
            .ToListAsync();

        if (!movements.Any())
        {
            return new ForecastResult(productId, 0f, 0, 0, "Sem histórico de saídas", 0);
        }

        var dailySeries = movements
            .GroupBy(m => m.Timestamp.Date)
            .Select(g => new { Date = g.Key, Quantity = (float)Math.Abs(g.Sum(m => m.QuantityChange)) })
            .OrderBy(x => x.Date)
            .ToList();

        if (!dailySeries.Any())
        {
            return new ForecastResult(productId, 0f, 0, 0, "Sem histórico de saídas", 0);
        }

        var completeSeries = BuildCompleteSeries(product, movements);
        var endDate = completeSeries.Last().Date;

        if (completeSeries.Count < 3)
        {
            return new ForecastResult(
                productId,
                completeSeries.Average(x => x.Outflow),
                dailySeries.Count,
                completeSeries.Count,
                "Média histórica simples",
                EstimateConfidence(dailySeries.Count, completeSeries.Count));
        }

        var cachedModel = await GetGlobalModelAsync(db);
        if (cachedModel == null)
        {
            return new ForecastResult(
                productId,
                completeSeries.Average(x => x.Outflow),
                dailySeries.Count,
                completeSeries.Count,
                "Média histórica simples",
                EstimateConfidence(dailySeries.Count, completeSeries.Count));
        }

        var lastWindow = completeSeries.Skip(Math.Max(0, completeSeries.Count - 7)).Take(7).ToList();
        var nextDate = endDate.AddDays(1);
        var input = new DemandObservation
        {
            Date = nextDate,
            DayOfWeek = (float)nextDate.DayOfWeek,
            DayOfMonth = nextDate.Day,
            Month = nextDate.Month,
            PreviousWeekAvg = lastWindow.Any() ? lastWindow.Average(x => x.Outflow) : 0f,
            Quantity = product.Quantity,
            MinQuantity = product.MinQuantity,
            Outflow = 0f
        };

        var predictionEngine = cachedModel.Context.Model.CreatePredictionEngine<DemandObservation, DemandPrediction>(cachedModel.Model);
        var predicted = Math.Max(0f, predictionEngine.Predict(input).Score);

        return new ForecastResult(
            productId,
            predicted,
            dailySeries.Count,
            completeSeries.Count,
            "ML.NET SDCA Regression",
            EstimateConfidence(dailySeries.Count, completeSeries.Count));
    }

    public static async Task<float> PredictDailyOutflowAsync(int productId, InventoryContext db)
    {
        var forecast = await ForecastDailyOutflowAsync(productId, db);
        return forecast.PredictedDailyOutflow;
    }

    private static async Task<CachedModel?> GetGlobalModelAsync(InventoryContext db)
    {
        var movementCount = await db.Movements.CountAsync(m => m.QuantityChange < 0);
        var latestMovement = await db.Movements
            .Where(m => m.QuantityChange < 0)
            .MaxAsync(m => (DateTime?)m.Timestamp);
        var signature = $"{movementCount}:{latestMovement?.Ticks ?? 0}";

        if (globalModel != null && globalModel.Signature == signature)
        {
            return globalModel;
        }

        await ModelLock.WaitAsync();
        try
        {
            if (globalModel != null && globalModel.Signature == signature)
            {
                return globalModel;
            }

            var products = await db.Products.AsNoTracking().ToDictionaryAsync(p => p.Id);
            var movements = await db.Movements
                .Where(m => m.QuantityChange < 0)
                .AsNoTracking()
                .ToListAsync();
            var trainingData = new List<DemandObservation>();

            foreach (var group in movements.GroupBy(m => m.ProductId))
            {
                if (!products.TryGetValue(group.Key, out var product)) continue;

                var completeSeries = BuildCompleteSeries(product, group.ToList());
                for (int i = 7; i < completeSeries.Count; i++)
                {
                    var window = completeSeries.Skip(i - 7).Take(7).ToList();
                    trainingData.Add(new DemandObservation
                    {
                        Date = completeSeries[i].Date,
                        DayOfWeek = completeSeries[i].DayOfWeek,
                        DayOfMonth = completeSeries[i].DayOfMonth,
                        Month = completeSeries[i].Month,
                        PreviousWeekAvg = window.Average(x => x.Outflow),
                        Quantity = product.Quantity,
                        MinQuantity = product.MinQuantity,
                        Outflow = completeSeries[i].Outflow
                    });
                }
            }

            if (!trainingData.Any())
            {
                return null;
            }

            var mlContext = new MLContext(seed: 42);
            var dataView = mlContext.Data.LoadFromEnumerable(trainingData);
            var pipeline = mlContext.Transforms
                .Concatenate("Features", nameof(DemandObservation.DayOfWeek), nameof(DemandObservation.DayOfMonth), nameof(DemandObservation.Month), nameof(DemandObservation.PreviousWeekAvg), nameof(DemandObservation.Quantity), nameof(DemandObservation.MinQuantity))
                .Append(mlContext.Regression.Trainers.Sdca(labelColumnName: "Label", featureColumnName: "Features"));
            var model = pipeline.Fit(dataView);

            globalModel = new CachedModel(signature, mlContext, model);
            return globalModel;
        }
        finally
        {
            ModelLock.Release();
        }
    }

    private static List<DemandObservation> BuildCompleteSeries(Product product, List<Movement> movements)
    {
        var dailySeries = movements
            .GroupBy(m => m.Timestamp.Date)
            .Select(g => new { Date = g.Key, Quantity = (float)Math.Abs(g.Sum(m => m.QuantityChange)) })
            .OrderBy(x => x.Date)
            .ToList();

        if (!dailySeries.Any())
        {
            return new List<DemandObservation>();
        }

        var startDate = dailySeries.First().Date;
        var endDate = dailySeries.Last().Date;
        var completeSeries = new List<DemandObservation>();

        for (var date = startDate; date <= endDate; date = date.AddDays(1))
        {
            var entry = dailySeries.FirstOrDefault(x => x.Date == date);
            completeSeries.Add(new DemandObservation
            {
                Date = date,
                DayOfWeek = (float)date.DayOfWeek,
                DayOfMonth = date.Day,
                Month = date.Month,
                PreviousWeekAvg = 0f,
                Quantity = product.Quantity,
                MinQuantity = product.MinQuantity,
                Outflow = entry?.Quantity ?? 0f
            });
        }

        return completeSeries;
    }

    private static int EstimateConfidence(int daysWithOutflow, int observationDays)
    {
        if (daysWithOutflow == 0 || observationDays == 0) return 0;
        var score = Math.Min(100, daysWithOutflow * 8 + observationDays * 3);
        return Math.Max(10, score);
    }

    public record ForecastResult(
        int ProductId,
        float PredictedDailyOutflow,
        int DaysWithOutflow,
        int ObservationDays,
        string Method,
        int ConfidencePercent);

    private record CachedModel(string Signature, MLContext Context, ITransformer Model);

    private class DemandObservation
    {
        public DateTime Date { get; set; }
        public float DayOfWeek { get; set; }
        public float DayOfMonth { get; set; }
        public float Month { get; set; }
        public float PreviousWeekAvg { get; set; }
        public float Quantity { get; set; }
        public float MinQuantity { get; set; }
        [ColumnName("Label")]
        public float Outflow { get; set; }
    }

    private class DemandPrediction
    {
        public float Score { get; set; }
    }
}
