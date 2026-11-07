COMPOSE = docker compose -f docker-compose.yml

all: up

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) --profile dev --profile prod down --remove-orphans

build:
	$(COMPOSE) build
	cd frontend/game && yarn build
	cd frontend/app && yarn build

rebuild:
	$(COMPOSE) up -d --build

logs:
	$(COMPOSE) logs -f

clean:
	$(COMPOSE) --profile dev --profile prod down -v --remove-orphans

fclean:
	$(COMPOSE) --profile dev --profile prod down -v --rmi local --remove-orphans

ps:
	$(COMPOSE) ps

install: backend-restore
	yarn install --frozen-lockfile
	cd frontend/game && yarn install --frozen-lockfile
	cd frontend/app && yarn install --frozen-lockfile

lint: lint-frontend lint-backend

lint-frontend:
	yarn lint
	yarn format:check

lint-backend: backend-restore
	dotnet format backend/TankIt.sln --verify-no-changes --no-restore

typecheck: typecheck-frontend typecheck-backend

typecheck-frontend:
	cd frontend/game && yarn typecheck
	cd frontend/app && yarn typecheck

typecheck-backend: backend-restore
	dotnet build backend/TankIt.sln --no-restore --configuration Release

test: test-frontend test-backend

# Local-only end-to-end suite (Playwright) — never part of CI, see e2e/README.md.
test-e2e: dev
	cd e2e && yarn install --frozen-lockfile
	cd e2e && yarn test

test-frontend:
	cd frontend/game && yarn test
	cd frontend/app && yarn test

test-backend: typecheck-backend
	dotnet test backend/TankIt.sln --no-build --no-restore --configuration Release

backend-restore:
	dotnet restore backend/TankIt.sln

dev:
	$(COMPOSE) --profile dev up -d

prod:
	$(COMPOSE) --profile prod up -d

db-migrate:
	cd backend && dotnet ef database update -p src/TankIt.Api -s src/TankIt.Api

db-migration-add name=MigrationName:
	cd backend && dotnet ef migrations add $(name) -p src/TankIt.Api -s src/TankIt.Api

.PHONY: all up down build rebuild logs clean fclean ps install dev prod lint lint-frontend lint-backend typecheck typecheck-frontend typecheck-backend test test-frontend test-backend test-e2e backend-restore db-migrate db-migration-add
