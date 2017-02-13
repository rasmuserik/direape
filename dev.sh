if [ ! -e node_modules/.bin/live-server ]; then npm install live-server eslint; fi
cat direape.js | sed -e 's/^/    /' | sed -e 's/^ *[/][/] \?//' > README.md
./node_modules/.bin/eslint *.js;

./node_modules/.bin/live-server --no-browser &
echo $! > .pid-live-server

export NODE_TLS_REJECT_UNAUTHORIZED=0
npm install --dev
while inotifywait -e modify,close_write,move_self -q *.js
do 
  kill `cat .pid`
  sleep 0.1
  node direape.js test server $@ &
  echo $! > .pid
  sleep 3
done

