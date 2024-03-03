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
	@docker logs $$(docker ps -a | awk '{ print $1,$2 }' | grep $$(basename $PWD)  | awk '{print $1 }')

open:	logs
	@docker attach $$(docker ps -a | awk '{ print $1,$2 }' | grep $$(basename $PWD)  | awk '{print $1 }')

stop:
	@docker stop $$(docker ps -a | awk '{ print $1,$2 }' | grep $$(basename $PWD)  | awk '{print $1 }')

clean:
	@docker rmi $$(docker images -aq $$(basename $(PWD)))