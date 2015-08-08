var crypto = require('crypto')
var koa = require('koa')
var app = koa()

app.use(function *strap(next) {
	this.id = crypto.randomBytes(12)
	yield next
})
app.use(require('./index')('Something broke!'))
app.use(function *failTest(next) {
	this.response.type='html'
	//this.throw('fail!')
	throw new Error('fail!')
	return
	this.body = 'Test'
})

app.listen(3000)