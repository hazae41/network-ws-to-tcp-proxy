PORT=8080

help:
	@echo "make build"
	@echo "make run"
	@echo "make logs"
	@echo "make open"
	@echo "make stop"
	@echo "make clean"

build:
	@docker build -t $$(basename $(PWD)):$$(git log -1 --pretty=%h) .

run:
	@docker run --rm -dit -p $(PORT):8080 $$(basename $(PWD)):$$(git log -1 --pretty=%h)

logs:
	@docker logs $$(docker ps -aq --filter ancestor=$$(basename $(PWD)):$$(git log -1 --pretty=%h))

open:	logs
	@docker attach $$(docker ps -aq --filter ancestor=$$(basename $(PWD)):$$(git log -1 --pretty=%h))

stop:
	@docker stop $$(docker ps -aq --filter ancestor=$$(basename $(PWD)):$$(git log -1 --pretty=%h))

clean:
	@docker rmi $$(docker images -aq $$(basename $(PWD)))