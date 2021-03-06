#!/usr/bin/env node
//
// koa-wince
// ---
// @copyright (c) 2015 Damian Bushong <katana@odios.us>
// @license MIT License
// @url <https://github.com/damianb/>
// @reddit <https://reddit.com/u/katana__>
// @twitter <https://twitter.com/blazingcrimson>
//
'use strict'

let fs = require('fs'),
	path = require('path'),
	util = require('util')

let jade = require('jade'),
	stackTrace = require('stack-trace')

module.exports = function enclosure(title, pretty) {
	let jadeFn = null
	pretty = !!pretty

	function frameModifier(frame) {
		// frame modification code here
		Object.defineProperty(frame, 'getFileLines', {
			value: function(start, length) {
				if(!start || start < 0) {
					start = 0
				}
				start = parseInt(start)
				length = parseInt(length)

				if(length <= 0) {
					throw new RangeError('length must be greater than 0')
				}

				let contents = ''
				let filePath = this.getFileName()
				if(filePath === 'Unknown' || !filePath) {
					return null
				}

				if (!fs.existsSync(filePath)) {
					if (process.env.NVM_DIR && process.versions.node) {
						filePath = path.join(process.env.NVM_DIR, 'src/node-v' + process.versions.node, 'lib', filePath);
						if (!fs.existsSync(filePath)) {
								return null;
						}
					} else {
						return null;
					}
				}

				contents = fs.readFileSync(filePath, 'utf-8')
				if(contents === null) {
					return null
				}

				return contents.split("\n").slice(start, start + length)
			}
		})
		return frame
	}

	return function *wince(next) {
		try {
			yield next
		} catch(err) {
			if(this.request.accepts('html')) {
				// if we've got koa-trace, might as well use it :D
				let hasTrace = false
				if(!!this.trace && typeof this.trace === 'function') {
					hasTrace = true
				}

				if(hasTrace) {
					this.trace('wince-run')
				}

				this.app.emit('error', err)
				let tplCtx = {
					pageTitle: title,
					exception: {
						name: err.name,
						message: err.message
					},
					frames: stackTrace.parse(err).map(frameModifier),
					// note: this.req is the underlying request object - it appears to bypass koa
					tables: {
						'Server/Request Data': {
							REMOTE_ADDR: this.request.ip,
							//SERVER_SOFTWARE: 'NodeJS ' + process.versions.node + " " + os.type(),
							SERVER_PROTOCOL: this.request.protocol + "/" + this.req.httpVersion,
							SCRIPT_FILE: require.main.filename,
							REQUEST_URI: this.request.url,
							REQUEST_METHOD: this.request.method,
							PATH_INFO: this.request.path,
							QUERY_STRING: this.request.querystring,
							HTTP_HOST: this.request.host,
							HTTP_CONNECTION: this.request.get('connection'),
							HTTP_CACHE_CONTROL: this.request.get('cache-control'),
							HTTP_ACCEPT: this.request.get('accept'),
							HTTP_USER_AGENT: this.request.get('user-agent'),
							HTTP_DNT: this.request.get('dnt'),
							HTTP_ACCEPT_ENCODING: this.request.get('accept-encoding'),
							HTTP_ACCEPT_LANGUAGE: this.request.get('accept-language'),
							HTTP_COOKIE: this.request.get('cookie')
						},
						'Request Parameters': {
							queryString: this.request.query,
							requestBody: this.req.body,

						},
						'Cookies': {},
						'Environment variables': process.env
					},
					asset: {
						script: {
							zepto: fs.readFileSync(path.join(__dirname, 'assets/js', 'zepto.min.js')),
							prettify: fs.readFileSync(path.join(__dirname, 'assets/js', 'prettify.min.js')),
							winceJS: fs.readFileSync(path.join(__dirname, 'assets/js', 'wince.min.js'))
						},
						style: {
							winceCSS: fs.readFileSync(path.join(__dirname, 'assets/css', 'wince.min.css'))
						}
					},
					util: util
				}

				// quick parsing of cookies for inspection
				let cookie = this.request.get('cookie')
				cookie.split(';').forEach(function (cookie) {
					let parts = cookie.split('=');
					tplCtx.tables['Cookies'][parts.shift().trim()] = decodeURI(parts.join('='));
				})

				if(!jadeFn) {
					let jadeFilename = path.join(__dirname, 'assets/views', 'wince.jade')
					jadeFn = jade.compileFile(jadeFilename, {
						pretty: pretty,
						filename: jadeFilename
					})
				}

				this.body = jadeFn(tplCtx)
				this.status = err.status || 500

				if(hasTrace) {
					this.trace('wince-done')
				}
			}
		}
	}
}