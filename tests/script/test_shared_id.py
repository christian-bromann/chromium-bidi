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

import re

import pytest
from test_helpers import execute_command, goto_url, set_html_content


@pytest.mark.asyncio
async def test_sharedId_in_same_realm_same_navigable(websocket, context_id,
                                                     html):
    await goto_url(websocket, context_id, html("<div>some text</div>"))

    result = await execute_command(
        websocket, {
            "method": "script.evaluate",
            "params": {
                "expression": "document.querySelector('body > div');",
                "target": {
                    "context": context_id
                },
                "awaitPromise": True
            }
        })

    shared_id = result["result"]["sharedId"]
    assert "UNKNOWN" not in shared_id

    result = await execute_command(
        websocket, {
            "method": "script.callFunction",
            "params": {
                "functionDeclaration": "(arg)=>arg",
                "this": {
                    "type": "undefined"
                },
                "arguments": [{
                    "sharedId": shared_id
                }],
                "awaitPromise": False,
                "target": {
                    "context": context_id
                }
            }
        })

    assert result["type"] == "success"
    assert result["result"]["sharedId"] == shared_id


@pytest.mark.asyncio
async def test_sharedId_without_navigation(websocket, context_id):
    await set_html_content(websocket, context_id, "<div>some text</div>")

    result = await execute_command(
        websocket, {
            "method": "script.evaluate",
            "params": {
                "expression": "document.querySelector('body > div');",
                "target": {
                    "context": context_id
                },
                "awaitPromise": True
            }
        })

    shared_id = result["result"]["sharedId"]
    assert "UNKNOWN" not in shared_id

    result = await execute_command(
        websocket, {
            "method": "script.callFunction",
            "params": {
                "functionDeclaration": "(arg)=>arg",
                "this": {
                    "type": "undefined"
                },
                "arguments": [{
                    "sharedId": shared_id
                }],
                "awaitPromise": False,
                "target": {
                    "context": context_id
                }
            }
        })

    assert result["type"] == "success"
    assert result["result"]["sharedId"] == shared_id


@pytest.mark.asyncio
async def test_sharedId_in_different_realm_same_navigable(
        websocket, context_id, html):
    await goto_url(websocket, context_id, html("<div>some text</div>"))

    result = await execute_command(
        websocket, {
            "method": "script.evaluate",
            "params": {
                "expression": "document.querySelector('body > div');",
                "target": {
                    "context": context_id,
                    "sandbox": "SOME_SANDBOX"
                },
                "awaitPromise": True
            }
        })

    realm_1 = result["realm"]
    shared_id = result["result"]["sharedId"]

    result = await execute_command(
        websocket, {
            "method": "script.callFunction",
            "params": {
                "functionDeclaration": "(arg)=>arg",
                "this": {
                    "type": "undefined"
                },
                "arguments": [{
                    "sharedId": shared_id
                }],
                "awaitPromise": False,
                "target": {
                    "context": context_id,
                    "sandbox": "ANOTHER_SANDBOX"
                }
            }
        })

    assert result["realm"] != realm_1
    assert result["type"] == "success"
    assert result["result"]["sharedId"] == shared_id


@pytest.mark.asyncio
async def test_sharedId_in_different_navigable(websocket, context_id, html):
    await goto_url(websocket, context_id, html("<div>some text</div>"))

    result = await execute_command(
        websocket, {
            "method": "script.evaluate",
            "params": {
                "expression": "document.querySelector('body > div');",
                "target": {
                    "context": context_id
                },
                "awaitPromise": True
            }
        })

    shared_id = result["result"]["sharedId"]

    await goto_url(websocket, context_id, html("some other page"))

    with pytest.raises(
            Exception,
            match=re.compile(
                str({
                    "error": "no such node",
                    "message": 'SharedId ".*" belongs to different document. Current document is .*'
                }))):
        await execute_command(
            websocket, {
                "method": "script.callFunction",
                "params": {
                    "functionDeclaration": "(arg)=>arg",
                    "this": {
                        "type": "undefined"
                    },
                    "arguments": [{
                        "sharedId": shared_id
                    }],
                    "awaitPromise": False,
                    "target": {
                        "context": context_id
                    }
                }
            })


@pytest.mark.asyncio
async def test_sharedId_not_found(websocket, context_id, html):
    await goto_url(websocket, context_id, html("<div>some text</div>"))

    result = await execute_command(
        websocket, {
            "method": "script.evaluate",
            "params": {
                "expression": "document.querySelector('body > div');",
                "target": {
                    "context": context_id
                },
                "awaitPromise": True
            }
        })

    shared_id = result["result"]["sharedId"] + "9999"

    with pytest.raises(Exception,
                       match=re.compile(
                           str({
                               "error": "no such node",
                               "message": 'SharedId ".*" was not found.'
                           }))):
        await execute_command(
            websocket, {
                "method": "script.callFunction",
                "params": {
                    "functionDeclaration": "(arg)=>arg",
                    "this": {
                        "type": "undefined"
                    },
                    "arguments": [{
                        "sharedId": shared_id
                    }],
                    "awaitPromise": False,
                    "target": {
                        "context": context_id
                    }
                }
            })
