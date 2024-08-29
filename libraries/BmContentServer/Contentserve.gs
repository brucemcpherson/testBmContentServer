

/**
 */

const ContentServe = (() => {

  // the cache entry it applies to should be a little longer before dying out 
  const TIMETOLIVE = 5 * 60


  /**
   * this will format a probe contentservice return
   * the value is the response from a hit content service request
   * only limited data is returned
   */
  const getProbe = (value) => {

    const { method, good = false, serveAs, expires,  probeInfo } = value || {}
    return {
      method,
      good,
      serveAs,
      expires,
      probeInfo
    }
  }

  /**
   * create content service style return
   */
  const handleResponse = (value) => {

    if (!value || !value.content || !value.good) {
      return handleNoContent()
    } else {
      return ContentService.createTextOutput(value.content)
        .setMimeType(ContentService.MimeType[value.serveAs])
    }
  }


  /**
   * handle stringify with error handling
   */
  const jstr = (item) => {
    if (!item) return null
    try {
      return JSON.stringify(item)
    } catch (err) {
      throw `unable to stringify ${item}`
    }
  }
  const jparse = (item) => {
    if (!item) return null
    try {
      return JSON.parse(item)
    } catch (err) {
      throw `unable to parse ${item}`
    }
  }

  const handleNoContent = () => {
    return ContentService.createTextOutput()
  }

  const handleProbe = (value) => {
    // reduce to just those props exposed by probe
    const probeOb = getProbe(value)
    return ContentService
      .createTextOutput(jstr(probeOb))
      .setMimeType(ContentService.MimeType.JSON)
  }

  /**
   * logic for doGet is here meaning the published web aoo can remain a one liner and this stuff can be in a library
   */
  const handleDoGet = (e) => {

    const param = (e && e.parameter) || {}
    const { method = "hit", probe } = param
    const probing = probe === "yes"

    // check we can get stuff
    // inject the default method
    const value = validateFetched({ ...param, method })

    // if couldnt get it, give up
    if (!value) {
      return probing ? handleProbe() : handleNoContent()
    }

    // this is the initial request using the hit-key
    if (method === "hit") {

      //  get infor for how to call ourselves
      const { cacheUrl, accessToken, nonce, serveAs, finger } = value

      if (!cacheUrl) {
        throw `unexpected missing cacheUrl - cant continue`
      }
      if (!accessToken) {
        throw `unexpected missing token - cant continue`
      }

      // if this is a probe - it can end here
      if (probing) return handleProbe(value)

      // this time we'll enter as the original user - so we'll dip into the at handler this time
      const response = UrlFetchApp.fetch(cacheUrl + `&nonce=${nonce}&serveAs=${serveAs}&finger=${finger}`, {
        muteHttpExceptions: true,
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      const text = response.getContentText()

      // this should never fail so we'd better throw if it does
      const status = response.getResponseCode()
      if (status !== 200) {
        throw `Failed to fetch cache access key info ${text}`
      }

      // it's possible we'll get no content if the thing has expired
      if (!text) {
        return handleNoContent()
      }

      // this would have been executed under the original user
      const resolved = jparse(text)

      // this is what has been returned by fetching from the at method
      return handleResponse(resolved)

    } else if (method === "at") {

      // this is returned to the fetch of the hit method - a stringfied version of the content
      // the reason we have to do it separetly is because it executes as a differnt user
      // hit executes anonymously
      return ContentService.createTextOutput(jstr(value))
        .setMimeType(ContentService.MimeType.JSON)

    } else {
      throw 'unsupported method at ${method}'
    }


  }

  /**
   * check all is good for any kind of call
   */
  const validateFetched = (param) => {

    const { key, nonce: sNonce, method, finger = null, probe = "no" } = param
    if (!key) throw `Key missing from parameters`
    if (!sNonce) throw `nonce missing from parameters`
    if (!method) throw `method missing from state parameters`

    // a hit method will use the script cache
    // anything else will use the user cache
    const cacher = getCacher({ anyone: method === "hit" })

    // now get the value from cache
    const value = cacher.get(key)
    if (!value) return null


    if (method !== "hit") {
      // any other method should have a fingerprint
      if (!value.finger) throw `fingerprint missing from state parameters`
    } else {
      // the hit method should give us at least these
      if (!value.accessToken) {
        throw `unexpected missing token for method ${method}- cant continue`
      }
      if (!value.cacheUrl) {
        throw `unexpected missing cacheUrl for method ${method} - cant continue`
      }
    }

    // more validation that we're looking at the correct thing
    // convert nonce to a number as it will have come thru as a string
    const nonce = parseInt(sNonce)
    if (nonce !== value.nonce) {
      throw `Attempt to access the wrong cache entry timestamp`
    }
    if (finger && finger !== value.finger) {
      throw `Attempt to access the wrong cache entry fingerprint`
    }
    if (key !== value.packKey) {
      throw `Attempt to access the wrong cache entry packKey`
    }

    // deal with maxhits etc.
    // we'll allow a small buffer just in case of processing time delays
    const aFewMs = 500
    const now = new Date().getTime()
    if (value.expires + aFewMs < now) throw `cache item has already expired`

    // there's a maxHits to check
    if (value.hits >= value.maxHits) {
      // this shouldn't be possible so scrap that
      throw `more than maximum attempts detected ${value.hits} > ${value.maxHits}`
    }

    // increase the hit count
    // try to avoid writing back cache entry if not necessary by deleting it when maxhits is reached
    value.hits++

    // time to delete this one ?
    if (value.hits >= value.maxHits) {
      cacher.remove(key)
    } else {

      // register an access an caclulate new ttl time 
      // taking account of time already passed and put to cache again
      // extend expiry time a little 
      value.expires += aFewMs
      const ttl = value.expires - now
      if (ttl < 0) throw `Something went wrong with cache expiry time ${value.expires} ${now}`
      const exp = Math.ceil(ttl / 1000)
      cacher.set(key, value, {
        expiry: exp
      })
    }

    return {
      ...value,
      key,
      nonce,
      method,
      finger,
      probing: probe === "yes",
      // if its a hit there wont be any data, but if we got this far, then its fine
      good: true
    }

  }

  // the cache to use will be dependent on the type of fetch
  const getCacher = ({ anyone }) => {
    return Exports.newCacher({
      cachePoint: getCacheStore({ anyone })
    })
  }

  // todo - usercache isnt working when its a library yet so makeing them both scrptcahce for now
  // important that we use the usercache to limit access to the same person that created the link
  const getCacheStore = ({ anyone = false } = {}) => {
    return anyone ? CacheService.getScriptCache() : CacheService.getUserCache()
  }

  /**
  * write contents of file to cache
  * @param {object} params the params
  * @param {string} [serviceUrl] the service url to override the published one available in this context
  * @param {object} [probeInfo={}] any data to be returned in reponse to a probe request
  * @param {ContentService.MimeType} [serveAs="TEXT"] for example JSON , TEXT  etc.. 
  * @param {string} [method="at"] which method to use "at" is only supported value for now
  * @param {number} [maxHits=1] max number of times this can be caretrieved
  * @param {string} [accessToken] only required if method is "at"
  * @param {string} [content] the content to share - if you just want to share probeinfo, this can be omitted
  * @param {string} [timeToLive=TIMETOLIVE] default seconds for entry to lvie for
  * @param {boolean} [devService=false] whether to use the default dev serviceurl (if a serviceurl argument is passed it takes precendence over this one)
  * @return {string} the  url to retrieve this data 
  */
  const toCache = ({
    content,
    serveAs = "TEXT",
    serviceUrl,
    method = "at",
    timeToLive = TIMETOLIVE,
    maxHits = 1,
    accessToken,
    devService,
    probeInfo={}
  }) => {

    const nonce = new Date().getTime()
    const surl = serviceUrl = serviceUrl || Exports.Servicer.getServiceUrl({mode:devService ? "dev": "exec" })

    // at is the the only one supported at present
    if (method !== "at") {
      throw `invalid auth method ${method}`
    }

    if (method === "at" && !accessToken) {
      throw `accessToken is required for method "at"`
    } else if (method !== "at" && accessToken) {
      throw `accessToken is not required for method ${method}`
    }

    if (!ContentService.MimeType[serveAs]) {
      throw `${serveAs} is an invalid contentservice mimetype`
    }

    // get the file content and config for key generation
    const config = {
      ...probeInfo,
      nonce,
      method
    }

    // generate a key for the cache entry holding the data
    const cacheKey = Exports.Utils.digester(config)

    // generate a key for the hit cache entry 
    const hitKey = Exports.Utils.digester(config, 'hit-key')

    // generate a fingerprint to validate the connection between the the hit key and the cachekey
    const finger = Exports.Utils.digester(config, 'fingerprint', hitKey, cacheKey)

    // and we'll decorate that with some other metadata
    // the cache time to live will be extended a little to allow for processing time delays
    // and any imprecision in the cache expiry method
    const aFewSecs = 5
    const cacheTtl = timeToLive + aFewSecs

    // this is when the thing will expire
    const expires = cacheTtl * 1000 + nonce

    // cache contents
    const pack = {
      content,
      nonce,
      finger,
      serveAs,
      maxHits,
      hits: 0,
      expires,
      packKey: cacheKey
    }


    // this url is the final that will be used for the secondary fetch
    const cacheUrl = surl + `?key=${cacheKey}&method=${method}&serveAs=${serveAs}&finger=${finger}`

    // this one is the one that's public facing
    const hitUrl = surl + `?key=${hitKey}&nonce=${nonce}`

    // user creates hitUrl which has a payload including the cacheUrl and a nonce and a finger for validation
    // on getting a hiturl, the webapp uses the cacheurl to get the data using the token as a bearer

    // data goes here
    // this is the user store
    const cacher = getCacher({ anyone: false })
    cacher.set(cacheKey, pack, {
      expiry: cacheTtl
    })

    // reference to method goes here
    // minimal info
    // note that the accesstoken here is never exposed
    // when the hit url is acccesed it never returns anything
    // instead it calls its cache key using this access token 
    // and returns the content from the cacheky
    // in the case of a probe it returns only limited info
    const hitPacket = {
      cacheUrl,
      nonce,
      finger,
      accessToken,
      hits: 0,
      expires,
      maxHits,
      probeInfo,
      packKey: hitKey
    }

    // thats an anyone store
    const hitCacher = getCacher({ anyone: true })
    hitCacher.set(hitKey, hitPacket, {
      expiry: cacheTtl
    })

    return hitUrl

  }

  return {
    toCache,
    handleDoGet

  }

})()
