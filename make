#!/bin/bash
redis_deamon=redis-sharding
redis_image=redis:4.0.2

ports=(7000 7001 7002 7003)

run () {
	docker rm -vf $redis_deamon"-"$1 || true
	docker run --name $redis_deamon"-"$1 -p $1:6379 -d $redis_image
}

install_redis () {
  docker pull $redis_image
	run ${ports[0]}
	run ${ports[1]}
	run ${ports[2]}
	run ${ports[3]}
	echo "正在启动redis，请耐心等待..."
	sleep 10
	docker ps -a | grep $redis_deamon
}

if [[ $1 = "install" ]]; then
	install_redis
else
	echo 'Usage: ./make <command>'
	echo ' '
	echo 'commands: '
	echo '  - install: 安装 redis'
	echo ' '
fi
