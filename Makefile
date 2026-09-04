COMPOSE = docker compose -f docker-compose.yml

all: up

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

build:
	$(COMPOSE) build

rebuild:
	$(COMPOSE) up -d --build

logs:
	$(COMPOSE) logs -f

clean:
	$(COMPOSE) down -v

dev:
	$(COMPOSE) --profile dev up

prod:
	$(COMPOSE) --profile prod up -d

.PHONY: all up down build rebuild logs clean dev prod