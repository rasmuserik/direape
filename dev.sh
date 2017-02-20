if [ ! -e node_modules/.bin/live-server ]; then npm install --save-dev live-server eslint uglify-js-harmony; fi

./node_modules/.bin/live-server --no-browser --ignore=node_modules &
echo $! > .pid-live-server

(sleep 3; touch direape.js) &
while inotifywait -e modify,close_write,move_self -q *.js
do 
  kill `cat .pid`
  sleep 0.1
  DIREAPE_DEV=true node direape.js test server $@ &
  echo $! > .pid
  cat direape.js | sed -e 's/^/    /' | sed -e 's/^ *[/][/] \?//' > README.md
  ./node_modules/.bin/eslint direape.js &
#  ./node_modules/.bin/uglifyjs -c 'pure_funcs=["da.test"]' < direape.js > direape.min.js 2> /dev/zero &
  sleep 3
done

