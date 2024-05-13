/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
export const mockSchema = `
{
  "$id": "https://developer.salesforce.com/mobile-tooling/preview-configuration.schema.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Mobile Component Preview",
  "description": "Configuration supporting preview of components on mobile devices.",
  "definitions": {
    "launch_argument": {
      "type": "object",
      "description": "A name or name/value argument to pass at launch time.",
      "properties": {
        "name": {
          "type": "string",
          "description": "The argument name."
        },
        "value": {
          "type": "string",
          "description": "The (optional) argument value."
        }
      },
      "required": [
        "name",
        "value"
      ]
    },
    "base_app": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "The app identifier."
        },
        "name": {
          "type": "string",
          "description": "A friendly name describing the app."
        },
        "get_app_bundle": {
          "type": "string",
          "description": "Module to get the app bundle to install. Executed from the directory of the configuration file."
        },
        "launch_arguments": {
          "type": "array",
          "description": "Collection of additional name or name/value arguments to pass when launching the app.",
          "items": {
            "$ref": "#/definitions/launch_argument"
          }
        },
        "preview_server_enabled": {
          "type": "boolean",
          "description": "A boolean indicating whether a local development server is required for previewing a component."
        }
      },
      "required": [
        "id",
        "name"
      ]
    },
    "ios_app": {
      "type": "object",
      "allOf": [
        {
          "$ref": "#/definitions/base_app"
        }
      ]
    },
    "android_app": {
      "type": "object",
      "allOf": [
        {
          "$ref": "#/definitions/base_app"
        },
        {
          "properties": {
            "activity": {
              "type": "string",
              "description": "The activity to launch."
            }
          },
          "required": [
            "activity"
          ]
        }
      ]
    },
    "ios_apps": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/ios_app"
      }
    },
    "android_apps": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/android_app"
      }
    },
    "apps": {
      "type": "object",
      "properties": {
        "ios": {
          "$ref": "#/definitions/ios_apps"
        },
        "android": {
          "$ref": "#/definitions/android_apps"
        }
      }
    }
  },
  "type": "object",
  "properties": {
    "apps": {
      "$ref": "#/definitions/apps"
    }
  }
}
`;
