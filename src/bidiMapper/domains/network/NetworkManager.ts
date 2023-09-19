/*
 * Copyright 2023 Google LLC.
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview This file implements the Network domain processor which is
 * responsible for processing Network domain events and redirecting events to
 * related `NetworkRequest`.
 */
import type Protocol from 'devtools-protocol';

import type {Network} from '../../../protocol/protocol.js';
import type {CdpTarget} from '../context/CdpTarget.js';

import type {NetworkRequest} from './NetworkRequest.js';
import type {NetworkStorage} from './NetworkStorage.js';

/** Maps 1:1 to CdpTarget. */
export class NetworkManager {
  readonly #cdpTarget: CdpTarget;
  readonly #networkStorage: NetworkStorage;

  private constructor(cdpTarget: CdpTarget, networkStorage: NetworkStorage) {
    this.#cdpTarget = cdpTarget;
    this.#networkStorage = networkStorage;
  }

  /** Returns the CDP Target associated with this NetworkManager instance. */
  get cdpTarget(): CdpTarget {
    return this.#cdpTarget;
  }

  #forgetNetworkRequest(requestId: Network.Request): void {
    this.#networkStorage.deleteRequest(requestId);
  }

  #getOrCreateNetworkRequest(id: Network.Request): NetworkRequest {
    const request = this.#networkStorage.getRequest(id);
    if (request) {
      return request;
    }
    return this.#networkStorage.createRequest(id);
  }

  static create(
    cdpTarget: CdpTarget,
    networkStorage: NetworkStorage
  ): NetworkManager {
    const networkManager = new NetworkManager(cdpTarget, networkStorage);

    cdpTarget.cdpClient
      .browserClient()
      .on(
        'Target.detachedFromTarget',
        (params: Protocol.Target.DetachedFromTargetEvent) => {
          if (cdpTarget.cdpClient.sessionId === params.sessionId) {
            networkManager.#networkStorage.disposeRequestMap();
          }
        }
      );

    cdpTarget.cdpClient.on(
      'Network.requestWillBeSent',
      (params: Protocol.Network.RequestWillBeSentEvent) => {
        const request = networkManager.#networkStorage.getRequest(
          params.requestId
        );
        if (request && request.isRedirecting()) {
          request.handleRedirect(params);
          networkManager.#forgetNetworkRequest(params.requestId);
          networkManager.#networkStorage
            .createRequest(params.requestId, request.redirectCount + 1)
            .onRequestWillBeSentEvent(params);
        } else if (request) {
          request.onRequestWillBeSentEvent(params);
        } else {
          networkManager.#networkStorage
            .createRequest(params.requestId)
            .onRequestWillBeSentEvent(params);
        }
      }
    );

    cdpTarget.cdpClient.on(
      'Network.requestWillBeSentExtraInfo',
      (params: Protocol.Network.RequestWillBeSentExtraInfoEvent) => {
        networkManager
          .#getOrCreateNetworkRequest(params.requestId)
          .onRequestWillBeSentExtraInfoEvent(params);
      }
    );

    cdpTarget.cdpClient.on(
      'Network.responseReceived',
      (params: Protocol.Network.ResponseReceivedEvent) => {
        networkManager
          .#getOrCreateNetworkRequest(params.requestId)
          .onResponseReceivedEvent(params);
      }
    );

    cdpTarget.cdpClient.on(
      'Network.responseReceivedExtraInfo',
      (params: Protocol.Network.ResponseReceivedExtraInfoEvent) => {
        networkManager
          .#getOrCreateNetworkRequest(params.requestId)
          .onResponseReceivedExtraInfoEvent(params);
      }
    );

    cdpTarget.cdpClient.on(
      'Network.requestServedFromCache',
      (params: Protocol.Network.RequestServedFromCacheEvent) => {
        networkManager
          .#getOrCreateNetworkRequest(params.requestId)
          .onServedFromCache();
      }
    );

    cdpTarget.cdpClient.on(
      'Network.loadingFailed',
      (params: Protocol.Network.LoadingFailedEvent) => {
        networkManager
          .#getOrCreateNetworkRequest(params.requestId)
          .onLoadingFailedEvent(params);
      }
    );

    return networkManager;
  }
}
