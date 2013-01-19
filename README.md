# dview

## About
This is a simple HTTP server that automatically pushes changes on files to clients.

With this, you can have your editor and browser side-by-side and check the output as you save files. Also, you can have multiple devices view the same page, so it's much easier to check multi-platform compatibility.

## How It Works
The server automatically appends a client-side script to HTML documents before serving. The client script, when executed, inspects the document and reports back to the server with the list of related resources. The server watches the resources, and when changes occur it tells clients to reload.

