# Immich Save
## Save images from Discord messages directly to your Immich server

This plugin allows you to save images from Discord messages to your Immich photo server with a simple long-press context menu.

## Features

- **Simple Configuration**: Just set your Immich API key and server URL
- **Context Menu Integration**: Long-press any message with images to see "Save to Immich" option
- **Multiple Format Support**: Supports JPG, PNG, GIF, WebP, BMP and other image formats
- **Batch Processing**: Automatically processes all images in a message
- **Official API**: Uses the official [Immich API](https://api.immich.app/sdk) and [uploadAsset endpoint](https://api.immich.app/endpoints/assets/uploadAsset)

## Setup

1. **Get your Immich API Key**:
   - Go to your Immich server settings
   - Generate an API key in the user settings

2. **Configure the Plugin**:
   - Open the plugin settings in Vendetta
   - Enter your Immich API Key
   - Enter your Immich Server URL (e.g., `https://immich.example.com`)

3. **Use the Context Menu**:
   - Long-press on any message containing images
   - Select "Save to Immich" from the context menu
   - Images will be uploaded to your Immich server

## Usage

- **Long-press** any message with image attachments
- Select **"Save to Immich"** from the context menu
- All images in the message will be uploaded to your Immich server
- You'll see a toast notification confirming the upload

## Requirements

- Immich server running and accessible
- Valid Immich API key
- Images must be in supported formats (JPG, PNG, GIF, WebP, BMP)

🔗 [**Install**](https://rillonDodgers.github.io/Apex-Plugins/ImmichSave)
👷‍♂️ [**Source code**](https://github.com/RillonDodgers/Apex-Plugins/tree/master/plugins/ImmichSave)
🪰 [**Bugs**](https://github.com/RillonDodgers/Apex-Plugins/issues/new?title=[ImmichSave])
