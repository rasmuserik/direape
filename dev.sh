if [ ! -e node_modules/.bin/live-server ]; then npm install live-server jshint; fi
cat main.js | sed -e 's/^/    /' | sed -e 's/^ *[/][/] \?//' > README.md
./node_modules/.bin/jshint *.js;
./node_modules/.bin/live-server --no-browser;
