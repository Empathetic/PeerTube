import Bluebird from 'bluebird'
import { URL } from 'url'
import validator from 'validator'
import { ContextType } from '@shared/models/activitypub/context'
import { ResultList } from '../../shared/models'
import { ACTIVITY_PUB, REMOTE_SCHEME } from '../initializers/constants'
import { MActor, MVideoWithHost } from '../types/models'
import { pageToStartAndCount } from './core-utils'
import { signJsonLDObject } from './peertube-crypto'

function getContextData (type: ContextType) {
  const context: any[] = [
    'https://www.w3.org/ns/activitystreams',
    'https://w3id.org/security/v1',
    {
      RsaSignature2017: 'https://w3id.org/security#RsaSignature2017'
    }
  ]

  if (type !== 'View' && type !== 'Announce') {
    const additional = {
      pt: 'https://joinpeertube.org/ns#',
      sc: 'http://schema.org#'
    }

    if (type === 'CacheFile') {
      Object.assign(additional, {
        expires: 'sc:expires',
        CacheFile: 'pt:CacheFile'
      })
    } else {
      Object.assign(additional, {
        Hashtag: 'as:Hashtag',
        uuid: 'sc:identifier',
        category: 'sc:category',
        licence: 'sc:license',
        subtitleLanguage: 'sc:subtitleLanguage',
        sensitive: 'as:sensitive',
        language: 'sc:inLanguage',

        // TODO: remove in a few versions, introduced in 4.2
        icons: 'as:icon',

        isLiveBroadcast: 'sc:isLiveBroadcast',
        liveSaveReplay: {
          '@type': 'sc:Boolean',
          '@id': 'pt:liveSaveReplay'
        },
        permanentLive: {
          '@type': 'sc:Boolean',
          '@id': 'pt:permanentLive'
        },

        Infohash: 'pt:Infohash',
        Playlist: 'pt:Playlist',
        PlaylistElement: 'pt:PlaylistElement',

        originallyPublishedAt: 'sc:datePublished',
        views: {
          '@type': 'sc:Number',
          '@id': 'pt:views'
        },
        state: {
          '@type': 'sc:Number',
          '@id': 'pt:state'
        },
        size: {
          '@type': 'sc:Number',
          '@id': 'pt:size'
        },
        fps: {
          '@type': 'sc:Number',
          '@id': 'pt:fps'
        },
        startTimestamp: {
          '@type': 'sc:Number',
          '@id': 'pt:startTimestamp'
        },
        stopTimestamp: {
          '@type': 'sc:Number',
          '@id': 'pt:stopTimestamp'
        },
        position: {
          '@type': 'sc:Number',
          '@id': 'pt:position'
        },
        commentsEnabled: {
          '@type': 'sc:Boolean',
          '@id': 'pt:commentsEnabled'
        },
        downloadEnabled: {
          '@type': 'sc:Boolean',
          '@id': 'pt:downloadEnabled'
        },
        waitTranscoding: {
          '@type': 'sc:Boolean',
          '@id': 'pt:waitTranscoding'
        },
        support: {
          '@type': 'sc:Text',
          '@id': 'pt:support'
        },
        likes: {
          '@id': 'as:likes',
          '@type': '@id'
        },
        dislikes: {
          '@id': 'as:dislikes',
          '@type': '@id'
        },
        playlists: {
          '@id': 'pt:playlists',
          '@type': '@id'
        },
        shares: {
          '@id': 'as:shares',
          '@type': '@id'
        },
        comments: {
          '@id': 'as:comments',
          '@type': '@id'
        }
      })
    }

    context.push(additional)
  }

  return {
    '@context': context
  }
}

function activityPubContextify <T> (data: T, type: ContextType = 'All') {
  return Object.assign({}, data, getContextData(type))
}

type ActivityPubCollectionPaginationHandler = (start: number, count: number) => Bluebird<ResultList<any>> | Promise<ResultList<any>>
async function activityPubCollectionPagination (
  baseUrl: string,
  handler: ActivityPubCollectionPaginationHandler,
  page?: any,
  size = ACTIVITY_PUB.COLLECTION_ITEMS_PER_PAGE
) {
  if (!page || !validator.isInt(page)) {
    // We just display the first page URL, we only need the total items
    const result = await handler(0, 1)

    return {
      id: baseUrl,
      type: 'OrderedCollectionPage',
      totalItems: result.total,
      first: baseUrl + '?page=1'
    }
  }

  const { start, count } = pageToStartAndCount(page, size)
  const result = await handler(start, count)

  let next: string | undefined
  let prev: string | undefined

  // Assert page is a number
  page = parseInt(page, 10)

  // There are more results
  if (result.total > page * size) {
    next = baseUrl + '?page=' + (page + 1)
  }

  if (page > 1) {
    prev = baseUrl + '?page=' + (page - 1)
  }

  return {
    id: baseUrl + '?page=' + page,
    type: 'OrderedCollectionPage',
    prev,
    next,
    partOf: baseUrl,
    orderedItems: result.data,
    totalItems: result.total
  }

}

function buildSignedActivity <T> (byActor: MActor, data: T, contextType?: ContextType) {
  const activity = activityPubContextify(data, contextType)

  return signJsonLDObject(byActor, activity)
}

function getAPId (object: string | { id: string }) {
  if (typeof object === 'string') return object

  return object.id
}

function checkUrlsSameHost (url1: string, url2: string) {
  const idHost = new URL(url1).host
  const actorHost = new URL(url2).host

  return idHost && actorHost && idHost.toLowerCase() === actorHost.toLowerCase()
}

function buildRemoteVideoBaseUrl (video: MVideoWithHost, path: string, scheme?: string) {
  if (!scheme) scheme = REMOTE_SCHEME.HTTP

  const host = video.VideoChannel.Actor.Server.host

  return scheme + '://' + host + path
}

// ---------------------------------------------------------------------------

export {
  checkUrlsSameHost,
  getAPId,
  activityPubContextify,
  activityPubCollectionPagination,
  buildSignedActivity,
  buildRemoteVideoBaseUrl
}
