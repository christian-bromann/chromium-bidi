# Copyright 2023 Google LLC.
# Copyright (c) Microsoft Corporation.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
import pytest
from anys import ANY_DICT, ANY_STR
from test_helpers import (ANY_TIMESTAMP, AnyExtending, goto_url,
                          read_JSON_message, send_JSON_command, subscribe)


@pytest.mark.asyncio
async def test_browsingContext_reload_waitNone(websocket, context_id, html):
    url = html()

    await subscribe(
        websocket,
        ["browsingContext.domContentLoaded", "browsingContext.load"])

    initial_navigation = await goto_url(websocket, context_id, url, "complete")

    await send_JSON_command(
        websocket, {
            "method": "browsingContext.reload",
            "params": {
                "context": context_id,
                "wait": "none",
            }
        })

    # Assert command done.
    response = await read_JSON_message(websocket)
    assert response["result"] == {
        "navigation": None,
        "url": url,
    }

    # Wait for `browsingContext.domContentLoaded` event.
    dom_content_load_event = await read_JSON_message(websocket)
    assert dom_content_load_event == {
        'type': 'event',
        "method": "browsingContext.domContentLoaded",
        "params": {
            "context": context_id,
            "navigation": ANY_STR,
            "timestamp": ANY_TIMESTAMP,
            "url": url,
        }
    }

    # Wait for `browsingContext.load` event.
    load_event = await read_JSON_message(websocket)
    assert load_event == {
        'type': 'event',
        "method": "browsingContext.load",
        "params": {
            "context": context_id,
            "navigation": ANY_STR,
            "timestamp": ANY_TIMESTAMP,
            "url": url,
        }
    }

    assert load_event["params"]["navigation"] == dom_content_load_event[
        "params"]["navigation"]
    assert initial_navigation["navigation"] != load_event["params"][
        "navigation"]


@pytest.mark.asyncio
async def test_browsingContext_reload_waitInteractive(websocket, context_id,
                                                      html):
    url = html()

    await subscribe(
        websocket,
        ["browsingContext.domContentLoaded", "browsingContext.load"])

    initial_navigation = await goto_url(websocket, context_id, url, "complete")

    await send_JSON_command(
        websocket, {
            "method": "browsingContext.reload",
            "params": {
                "context": context_id,
                "wait": "interactive",
            }
        })
    # Wait for `browsingContext.domContentLoaded` event.
    dom_content_load_event = await read_JSON_message(websocket)
    assert dom_content_load_event == {
        'type': 'event',
        "method": "browsingContext.domContentLoaded",
        "params": {
            "context": context_id,
            "navigation": ANY_STR,
            "timestamp": ANY_TIMESTAMP,
            "url": url,
        }
    }

    # Assert command done.
    response = await read_JSON_message(websocket)
    assert response["result"] == {
        "navigation": ANY_STR,
        "url": url,
    }

    # Wait for `browsingContext.load` event.
    load_event = await read_JSON_message(websocket)
    assert load_event == {
        'type': 'event',
        "method": "browsingContext.load",
        "params": {
            "context": context_id,
            "navigation": ANY_STR,
            "timestamp": ANY_TIMESTAMP,
            "url": url,
        }
    }

    assert load_event["params"]["navigation"] == response["result"][
        "navigation"] == dom_content_load_event["params"]["navigation"]
    assert initial_navigation["navigation"] != response["result"]["navigation"]


@pytest.mark.asyncio
async def test_browsingContext_reload_waitComplete(websocket, context_id,
                                                   html):
    url = html()

    await subscribe(
        websocket,
        ["browsingContext.domContentLoaded", "browsingContext.load"])

    initial_navigation = await goto_url(websocket, context_id, url, "complete")

    await send_JSON_command(
        websocket, {
            "method": "browsingContext.reload",
            "params": {
                "context": context_id,
                "wait": "complete",
            }
        })

    # Wait for `browsingContext.domContentLoaded` event.
    dom_content_loaded_event = await read_JSON_message(websocket)
    assert dom_content_loaded_event == {
        'type': 'event',
        "method": "browsingContext.domContentLoaded",
        "params": {
            "context": context_id,
            "navigation": ANY_STR,
            "timestamp": ANY_TIMESTAMP,
            "url": url,
        }
    }

    # Wait for `browsingContext.load` event.
    load_event = await read_JSON_message(websocket)
    assert load_event == {
        'type': 'event',
        "method": "browsingContext.load",
        "params": {
            "context": context_id,
            "navigation": ANY_STR,
            "timestamp": ANY_TIMESTAMP,
            "url": url,
        }
    }

    # Assert command done.
    response = await read_JSON_message(websocket)
    assert response["result"] == {
        "navigation": ANY_STR,
        "url": url,
    }

    assert response["result"]["navigation"] == load_event["params"][
        "navigation"] == dom_content_loaded_event["params"]["navigation"]
    assert initial_navigation["navigation"] != response["result"]["navigation"]


@pytest.mark.asyncio
@pytest.mark.parametrize("ignoreCache", [True, False])
async def test_browsingContext_reload_ignoreCache(websocket, context_id,
                                                  ignoreCache, cacheable_url):
    if not ignoreCache:
        pytest.xfail(
            "TODO: https://github.com/GoogleChromeLabs/chromium-bidi/pull/1466/files#r1377517937 need to be fixed"
        )

    await subscribe(websocket, [
        "network.beforeRequestSent",
        "network.responseCompleted",
    ])

    initial_navigation = await goto_url(websocket, context_id, cacheable_url)

    id = await send_JSON_command(
        websocket, {
            "method": "browsingContext.reload",
            "params": {
                "context": context_id,
                "ignoreCache": ignoreCache,
                "wait": "complete",
            }
        })

    before_request_sent_event = await read_JSON_message(websocket)
    assert before_request_sent_event == {
        'type': 'event',
        "method": "network.beforeRequestSent",
        "params": {
            "isBlocked": False,
            "context": context_id,
            "initiator": ANY_DICT,
            "navigation": ANY_STR,
            "redirectCount": 0,
            "request": ANY_DICT,
            "timestamp": ANY_TIMESTAMP,
        },
    }

    response_completed_event = await read_JSON_message(websocket)
    assert response_completed_event == {
        'type': 'event',
        "method": "network.responseCompleted",
        "params": {
            "isBlocked": False,
            "context": context_id,
            "navigation": ANY_STR,
            "redirectCount": 0,
            "request": ANY_DICT,
            "response": AnyExtending({"status": 200 if ignoreCache else 304}),
            "timestamp": ANY_TIMESTAMP,
        },
    }

    # Assert command done.
    response = await read_JSON_message(websocket)
    assert response == {
        "id": id,
        "type": "success",
        "result": {
            "navigation": ANY_STR,
            "url": cacheable_url,
        },
    }

    assert response["result"]["navigation"] == response_completed_event[
        "params"]["navigation"] == before_request_sent_event["params"][
            "navigation"]
    assert initial_navigation["navigation"] != response["result"]["navigation"]
