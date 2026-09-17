COMPOSE = docker compose -f docker-compose.yml

all: up

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) --profile dev --profile prod down --remove-orphans

build:
	$(COMPOSE) build

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

dev:
	$(COMPOSE) --profile dev up -d

prod:
	$(COMPOSE) --profile prod up -d

.PHONY: all up down build rebuild logs clean fclean ps dev prod