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

phaser-dev:
	$(COMPOSE) -f docker-compose.dev.yml up -d frontend

.PHONY: all up down build rebuild logs clean phaser-dev
