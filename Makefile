.PHONY: install dev start check test test-ui build
install:
	npm ci
dev:
	npm run dev
start:
	npm start
check:
	npm run check
test:
	npm test
test-ui:
	npm run test:ui
build:
	npm run build
