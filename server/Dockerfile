FROM mcr.microsoft.com/dotnet/sdk:7.0 AS build
WORKDIR /src
COPY .. .
WORKDIR /src/server
RUN dotnet publish "InventoryApi.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:7.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
COPY --from=build /src/client ./client
ENV ASPNETCORE_URLS=http://+:80
EXPOSE 80
ENTRYPOINT ["dotnet", "InventoryApi.dll"]
