.PHONY: up down build logs seed db-only restart ps ocr-up ocr-down ocr-logs backup tree

# Stack: docker-compose.sips.yml (mysql-sips + api + web + ocr)
COMPOSE = docker compose -f docker-compose.sips.yml

up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

build:
	$(COMPOSE) build

logs:
	$(COMPOSE) logs -f --tail=100

ps:
	$(COMPOSE) ps

# Hanya MySQL untuk dev lokal (API/Web di host via bun)
db-only:
	$(COMPOSE) up -d mysql-sips

seed:
	$(COMPOSE) exec api bun run prisma/seed.ts

# Structure helper
tree:
	@echo "apps/ api web ocr | packages/ shared | docker/ storage/"

restart:
	$(COMPOSE) restart

# OCR service — model di-mount dari host, lihat README section F
ocr-up:
	$(COMPOSE) up -d --build ocr

ocr-down:
	$(COMPOSE) stop ocr

ocr-logs:
	$(COMPOSE) logs -f --tail=100 ocr

# Backup MySQL (sips_db)
backup:
	@mkdir -p backups
	$(COMPOSE) exec -T mysql-sips mysqldump -u root -p"$$SIPS_MYSQL_ROOT_PASSWORD" --single-transaction --routines $$SIPS_MYSQL_DATABASE > backups/sips_$$(date +%Y%m%d_%H%M%S).sql
	@echo "Backup saved to backups/"
