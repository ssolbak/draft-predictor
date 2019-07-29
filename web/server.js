const express = require('express');
const app = express();
const exphbs  = require('express-handlebars');
const bodyParser = require('body-parser');
const controller = require("./controller");

app.engine('.hbs', exphbs({
    extname : ".hbs",
    defaultLayout: 'main.hbs',
    helpers : require("./helpers")
    //,partialsDir: "views/partials/"
}));
app.set('view engine', '.hbs');

app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
}));

app.get('/', controller.show);

app.post('/', controller.addPlayer);

app.get('/delete/:playerId', controller.removePlayer);

app.get('/regen', controller.regenerateData);

var app = app.listen(3000, function () {

    var host = app.address().address;
    var port = app.address().port;

    console.log('Example app listening at http://%s:%s', host, port);
});


