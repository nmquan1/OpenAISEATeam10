.PHONY: help install start dev backend frontend build test check

help:
	@echo "make install  Install workspace dependencies"
	@echo "make dev      Start backend with file watching and serve the frontend"
	@echo "make start    Start the app without file watching"
	@echo "make build    Build the static scenario preview in dist/"
	@echo "make test     Run backend tests"
	@echo "make check    Check syntax, tests and static build"

install:
	npm ci

start:
	npm start

dev:
	npm run dev

backend:
	npm run dev --workspace @market-maker/backend

frontend:
	npm run dev --workspace @market-maker/frontend

build:
	npm run build

test:
	npm test

check:
	npm run check
