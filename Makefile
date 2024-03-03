PORT=8080

help:
	@echo "docker-build"
	@echo "docker-run"
	@echo "docker-logs"
	@echo "docker-open"
	@echo "docker-stop"
	@echo "docker-clean"
	@echo "docker"

docker-build:
	@docker build -t $$(basename $(PWD)):$$(git log -1 --pretty=%h) .

docker-run:
	@docker run --rm -dit -p $(PORT):8080 $$(basename $(PWD)):$$(git log -1 --pretty=%h)

docker-logs:
	@docker logs $$(docker ps -aq --filter ancestor=$$(basename $(PWD)):$$(git log -1 --pretty=%h))

docker-open:	docker-logs
	@docker attach $$(docker ps -aq --filter ancestor=$$(basename $(PWD)):$$(git log -1 --pretty=%h))

docker-stop:
	@docker stop $$(docker ps -aq --filter ancestor=$$(basename $(PWD)):$$(git log -1 --pretty=%h))

docker-clean:
	@docker rmi $$(docker images -aq $$(basename $(PWD)))

docker: docker-build docker-run docker-open