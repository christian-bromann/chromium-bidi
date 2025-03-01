/**
 * Copyright 2021 Google LLC.
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

import type {ICdpClient} from '../cdp/CdpClient';
import type {ICdpConnection} from '../cdp/CdpConnection.js';
import {
  Exception,
  UnknownCommandException,
  UnknownErrorException,
  UnsupportedOperationException,
  type ChromiumBidi,
} from '../protocol/protocol.js';
import {EventEmitter} from '../utils/EventEmitter.js';
import {LogType, type LoggerFn} from '../utils/log.js';
import type {Result} from '../utils/result.js';

import {BidiNoOpParser} from './BidiNoOpParser.js';
import type {IBidiParser} from './BidiParser.js';
import {BrowserProcessor} from './domains/browser/BrowserProcessor.js';
import {CdpProcessor} from './domains/cdp/CdpProcessor.js';
import {BrowsingContextProcessor} from './domains/context/BrowsingContextProcessor.js';
import type {BrowsingContextStorage} from './domains/context/BrowsingContextStorage.js';
import type {EventManager} from './domains/events/EventManager.js';
import {InputProcessor} from './domains/input/InputProcessor.js';
import {NetworkProcessor} from './domains/network/NetworkProcessor.js';
import {NetworkStorage} from './domains/network/NetworkStorage.js';
import {PreloadScriptStorage} from './domains/script/PreloadScriptStorage.js';
import type {RealmStorage} from './domains/script/RealmStorage.js';
import {ScriptProcessor} from './domains/script/ScriptProcessor.js';
import {SessionProcessor} from './domains/session/SessionProcessor.js';
import {OutgoingMessage} from './OutgoingMessage.js';

export const enum CommandProcessorEvents {
  Response = 'response',
}

type CommandProcessorEventsMap = {
  [CommandProcessorEvents.Response]: {
    message: Promise<Result<OutgoingMessage>>;
    event: string;
  };
};

export class CommandProcessor extends EventEmitter<CommandProcessorEventsMap> {
  // keep-sorted start
  #browserProcessor: BrowserProcessor;
  #browsingContextProcessor: BrowsingContextProcessor;
  #cdpProcessor: CdpProcessor;
  #inputProcessor: InputProcessor;
  #networkProcessor: NetworkProcessor;
  #scriptProcessor: ScriptProcessor;
  #sessionProcessor: SessionProcessor;
  // keep-sorted end

  #parser: IBidiParser;
  #logger?: LoggerFn;

  constructor(
    cdpConnection: ICdpConnection,
    browserCdpClient: ICdpClient,
    eventManager: EventManager,
    selfTargetId: string,
    browsingContextStorage: BrowsingContextStorage,
    realmStorage: RealmStorage,
    acceptInsecureCerts: boolean,
    parser: IBidiParser = new BidiNoOpParser(),
    logger?: LoggerFn
  ) {
    super();
    this.#parser = parser;
    this.#logger = logger;

    const networkStorage = new NetworkStorage();
    const preloadScriptStorage = new PreloadScriptStorage();

    // keep-sorted start block=yes
    this.#browserProcessor = new BrowserProcessor(browserCdpClient);
    this.#browsingContextProcessor = new BrowsingContextProcessor(
      cdpConnection,
      browserCdpClient,
      selfTargetId,
      eventManager,
      browsingContextStorage,
      realmStorage,
      networkStorage,
      preloadScriptStorage,
      acceptInsecureCerts,
      logger
    );
    this.#cdpProcessor = new CdpProcessor(
      browsingContextStorage,
      cdpConnection,
      browserCdpClient
    );
    this.#inputProcessor = new InputProcessor(browsingContextStorage);
    this.#networkProcessor = new NetworkProcessor(
      browsingContextStorage,
      networkStorage
    );
    this.#scriptProcessor = new ScriptProcessor(
      browsingContextStorage,
      realmStorage,
      preloadScriptStorage,
      logger
    );
    this.#sessionProcessor = new SessionProcessor(eventManager);
    // keep-sorted end
  }

  async #processCommand(
    command: ChromiumBidi.Command
  ): Promise<ChromiumBidi.ResultData> {
    switch (command.method) {
      case 'session.end':
      case 'session.new':
        // TODO: Implement.
        break;

      // Browser domain
      // keep-sorted start block=yes
      case 'browser.close':
        return this.#browserProcessor.close();
      // keep-sorted end

      // Browsing Context domain
      // keep-sorted start block=yes
      case 'browsingContext.activate':
        return await this.#browsingContextProcessor.activate(
          this.#parser.parseActivateParams(command.params)
        );
      case 'browsingContext.captureScreenshot':
        return await this.#browsingContextProcessor.captureScreenshot(
          this.#parser.parseCaptureScreenshotParams(command.params)
        );
      case 'browsingContext.close':
        return await this.#browsingContextProcessor.close(
          this.#parser.parseCloseParams(command.params)
        );
      case 'browsingContext.create':
        return await this.#browsingContextProcessor.create(
          this.#parser.parseCreateParams(command.params)
        );
      case 'browsingContext.getTree':
        return this.#browsingContextProcessor.getTree(
          this.#parser.parseGetTreeParams(command.params)
        );
      case 'browsingContext.handleUserPrompt':
        return await this.#browsingContextProcessor.handleUserPrompt(
          this.#parser.parseHandleUserPromptParams(command.params)
        );
      case 'browsingContext.locateNodes':
        throw new UnsupportedOperationException(
          `Command '${command.method}' not yet implemented.`
        );
      case 'browsingContext.navigate':
        return await this.#browsingContextProcessor.navigate(
          this.#parser.parseNavigateParams(command.params)
        );
      case 'browsingContext.print':
        return await this.#browsingContextProcessor.print(
          this.#parser.parsePrintParams(command.params)
        );
      case 'browsingContext.reload':
        return await this.#browsingContextProcessor.reload(
          this.#parser.parseReloadParams(command.params)
        );
      case 'browsingContext.setViewport':
        return await this.#browsingContextProcessor.setViewport(
          this.#parser.parseSetViewportParams(command.params)
        );
      case 'browsingContext.traverseHistory':
        return await this.#browsingContextProcessor.traverseHistory(
          this.#parser.parseTraverseHistoryParams(command.params)
        );
      // keep-sorted end

      // CDP domain
      // keep-sorted start block=yes
      case 'cdp.getSession':
        return this.#cdpProcessor.getSession(
          this.#parser.parseGetSessionParams(command.params)
        );
      case 'cdp.sendCommand':
        return await this.#cdpProcessor.sendCommand(
          this.#parser.parseSendCommandParams(command.params)
        );
      // keep-sorted end

      // Input domain
      // keep-sorted start block=yes
      case 'input.performActions':
        return await this.#inputProcessor.performActions(
          this.#parser.parsePerformActionsParams(command.params)
        );
      case 'input.releaseActions':
        return await this.#inputProcessor.releaseActions(
          this.#parser.parseReleaseActionsParams(command.params)
        );
      // keep-sorted end

      // Network domain
      // keep-sorted start block=yes
      case 'network.addIntercept':
        return await this.#networkProcessor.addIntercept(
          this.#parser.parseAddInterceptParams(command.params)
        );
      case 'network.continueRequest':
        return await this.#networkProcessor.continueRequest(
          this.#parser.parseContinueRequestParams(command.params)
        );
      case 'network.continueResponse':
        return await this.#networkProcessor.continueResponse(
          this.#parser.parseContinueResponseParams(command.params)
        );
      case 'network.continueWithAuth':
        return await this.#networkProcessor.continueWithAuth(
          this.#parser.parseContinueWithAuthParams(command.params)
        );
      case 'network.failRequest':
        return await this.#networkProcessor.failRequest(
          this.#parser.parseFailRequestParams(command.params)
        );
      case 'network.provideResponse':
        return await this.#networkProcessor.provideResponse(
          this.#parser.parseProvideResponseParams(command.params)
        );
      case 'network.removeIntercept':
        return await this.#networkProcessor.removeIntercept(
          this.#parser.parseRemoveInterceptParams(command.params)
        );
      // keep-sorted end

      // Script domain
      // keep-sorted start block=yes
      case 'script.addPreloadScript':
        return await this.#scriptProcessor.addPreloadScript(
          this.#parser.parseAddPreloadScriptParams(command.params)
        );
      case 'script.callFunction':
        return await this.#scriptProcessor.callFunction(
          this.#parser.parseCallFunctionParams(command.params)
        );
      case 'script.disown':
        return await this.#scriptProcessor.disown(
          this.#parser.parseDisownParams(command.params)
        );
      case 'script.evaluate':
        return await this.#scriptProcessor.evaluate(
          this.#parser.parseEvaluateParams(command.params)
        );
      case 'script.getRealms':
        return this.#scriptProcessor.getRealms(
          this.#parser.parseGetRealmsParams(command.params)
        );
      case 'script.removePreloadScript':
        return await this.#scriptProcessor.removePreloadScript(
          this.#parser.parseRemovePreloadScriptParams(command.params)
        );
      // keep-sorted end

      // Session domain
      // keep-sorted start block=yes
      case 'session.status':
        return this.#sessionProcessor.status();
      case 'session.subscribe':
        return this.#sessionProcessor.subscribe(
          this.#parser.parseSubscribeParams(command.params),
          command.channel
        );
      case 'session.unsubscribe':
        return this.#sessionProcessor.unsubscribe(
          this.#parser.parseSubscribeParams(command.params),
          command.channel
        );
      // keep-sorted end
    }

    // Intentionally kept outside of the switch statement to ensure that
    // ESLint @typescript-eslint/switch-exhaustiveness-check triggers if a new
    // command is added.
    throw new UnknownCommandException(`Unknown command '${command.method}'.`);
  }

  async processCommand(command: ChromiumBidi.Command): Promise<void> {
    try {
      const result = await this.#processCommand(command);

      const response = {
        type: 'success',
        id: command.id,
        result,
      } satisfies ChromiumBidi.CommandResponse;

      this.emit(CommandProcessorEvents.Response, {
        message: OutgoingMessage.createResolved(response, command.channel),
        event: command.method,
      });
    } catch (e) {
      if (e instanceof Exception) {
        this.emit(CommandProcessorEvents.Response, {
          message: OutgoingMessage.createResolved(
            e.toErrorResponse(command.id),
            command.channel
          ),
          event: command.method,
        });
      } else {
        const error = e as Error;
        this.#logger?.(LogType.bidi, error);
        this.emit(CommandProcessorEvents.Response, {
          message: OutgoingMessage.createResolved(
            new UnknownErrorException(
              error.message,
              error.stack
            ).toErrorResponse(command.id),
            command.channel
          ),
          event: command.method,
        });
      }
    }
  }
}
