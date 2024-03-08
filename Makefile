#!make
include .env.local

PORT?=8080

help:
	@echo "make build"
	@echo "make start"
	@echo "make logs"
	@echo "make open"
	@echo "make stop"
	@echo "make clean"

build:
	@docker build --build-arg port=$(PORT) -t $$(basename $(PWD)):$$(git log -1 --pretty=%h) .

start:
	@docker run --rm -it -p $(PORT):$(PORT) -v $(CERT):$(CERT) -v $(KEY):$(KEY) $$(basename $(PWD)):$$(git log -1 --pretty=%h)

logs:
	@docker logs $$(docker ps -a | awk '{ print $$1,$$2 }' | grep $$(basename $(PWD))  | awk '{print $$1 }')

open:	logs
	@docker attach $$(docker ps -a | awk '{ print $$1,$$2 }' | grep $$(basename $(PWD))  | awk '{print $$1 }')

stop:
	@docker stop $$(docker ps -a | awk '{ print $$1,$$2 }' | grep $$(basename $(PWD))  | awk '{print $$1 }')

clean:
	@docker rmi $$(docker images -aq $$(basename $(PWD)))