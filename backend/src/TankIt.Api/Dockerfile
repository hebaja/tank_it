FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY backend/src/TankIt.Api/TankIt.Api.csproj backend/src/TankIt.Api/
RUN dotnet restore backend/src/TankIt.Api/TankIt.Api.csproj
COPY backend/src/TankIt.Api/ backend/src/TankIt.Api/
COPY frontend/game/public/assets/map/tanks_map.json frontend/game/public/assets/map/tanks_map.json
WORKDIR /src/backend/src/TankIt.Api
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "TankIt.Api.dll"]
