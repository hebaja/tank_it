# syntax=docker/dockerfile:1

# --- Landing / lobby (served at /) -----------------------------------------
FROM node:20-alpine AS landing
WORKDIR /src/frontend/app
RUN corepack enable
COPY frontend/app/package.json frontend/app/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY frontend/app/ ./
# Same origin as the API in production; overridable for split deployments.
ARG VITE_HUB_URL=/hubs/game
ARG VITE_GAME_URL=/play/
ENV VITE_HUB_URL=$VITE_HUB_URL \
    VITE_GAME_URL=$VITE_GAME_URL
RUN yarn build

# --- Phaser game (served at /play/) ----------------------------------------
FROM node:20-alpine AS game
WORKDIR /src/frontend/game
RUN corepack enable
COPY frontend/game/package.json frontend/game/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY frontend/game/ ./
ARG VITE_HUB_URL=/hubs/game
ENV VITE_HUB_URL=$VITE_HUB_URL
RUN yarn build-nolog

# --- ASP.NET Core API ------------------------------------------------------
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
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app .
COPY --from=landing /src/frontend/app/dist/ ./wwwroot/
COPY --from=game /src/frontend/game/dist/ ./wwwroot/play/
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "TankIt.Api.dll"]
