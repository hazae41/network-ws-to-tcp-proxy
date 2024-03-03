PORT=8080

help:
	@echo "build"
	@echo "run"
	@echo "logs"
	@echo "open"
	@echo "stop"
	@echo "clean"

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