const request = require('request')
const url = require('url')
const userAgentTest =
  /(bot|lighthouse|spider|pinterest|crawler|archiver|flipboard|mediapartners|facebookexternalhit|quora|whatsapp|outbrain|yahoo! slurp|embedly|developers.google.com\/+\/web\/snippet|vkshare|w3c_validator|tumblr|skypeuripreview|nuzzel|qwantify|bitrix link preview|XING-contenttabreceiver|Chrome-Lighthouse|mail\.ru)/gi

module.exports = function (token, options) {
  if (!token) throw new Error('token must be set')

  let apiEndPoint = options?.apiEndPoint ?? 'http://api.seo4ajax.com/'
  if (!apiEndPoint.endsWith('/')) {
    apiEndPoint = apiEndPoint + '/' // Fixed double assignment
  }

  let rootPath = options?.rootPath ?? ''
  if (rootPath) {
    if (!rootPath.startsWith('/')) {
      rootPath = '/' + rootPath
    }
    if (rootPath.endsWith('/')) {
      rootPath = rootPath.substring(0, rootPath.length - 1)
    }
  }

  const baseUrl = apiEndPoint + token + rootPath
  const s4aRequest = request.defaults({
    followRedirect: false,
  })

  return function (req, res, next) {
    let parsedUrl, xForwardedFor

    function serveCapture() {
      xForwardedFor = req.headers['x-forwarded-for']
      if (xForwardedFor) {
        xForwardedFor = req.connection.remoteAddress + ', ' + xForwardedFor
      } else {
        xForwardedFor = req.connection.remoteAddress
      }
      req.headers['x-forwarded-for'] = xForwardedFor

      const proxiedReq = s4aRequest.get(baseUrl + parsedUrl.path)

      proxiedReq.on('response', proxiedRes => {
        if (proxiedRes.statusCode === 503 || proxiedRes.statusCode === 404) {
          proxiedReq.abort()
          return next()
        }
      })

      req.pipe(proxiedReq).on('error', next).pipe(res).on('error', next)
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next()
    }

    parsedUrl = url.parse(req.url, true)

    if (parsedUrl.query && parsedUrl.query['_escaped_fragment_'] != null)
      return serveCapture()

    if (
      parsedUrl.path &&
      !parsedUrl.path.match(/index\.html?/i) &&
      parsedUrl.path.match(/.*(\.[^?]{2,4}$|\.[^?]{2,4}?.*)/)
    )
      return next()

    if (
      req.headers['user-agent'] &&
      req.headers['user-agent'].match(
        options?.includeUserAgents ?? userAgentTest,
      ) &&
      (options?.ignoreUserAgents
        ? !req.headers['user-agent'].match(options.ignoreUserAgents)
        : true) &&
      (options?.pathPattern ? req.path.match(options.pathPattern) : true)
    )
      return serveCapture()

    return next()
  }
}
