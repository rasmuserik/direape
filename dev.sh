if [ ! -e node_modules/.bin/live-server ]; then npm install live-server eslint; fi
cat direape.js | sed -e 's/^/    /' | sed -e 's/^ *[/][/] \?//' > README.md
./node_modules/.bin/eslint *.js;
./node_modules/.bin/live-server --no-browser;
