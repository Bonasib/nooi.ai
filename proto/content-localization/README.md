# NVIDIA Content Localization protos

These `.proto` files are copied unchanged from NVIDIA's Content Localization blueprint
(https://github.com/NVIDIA-AI-Blueprints/content-localization, commit 77767c7, `protos/`), which is
licensed under the Apache License 2.0 (see `LICENSE.md`, copied unchanged from that repository).

nooi.ai's server (`lib/localize.js`) loads them with `@grpc/proto-loader` and talks to your own
deployment of the blueprint's controller (`nvidia.ai4m.controller.v1.ContentLocalizationController`,
default port 50056) when an admin saves its address in Admin → AI providers → NVIDIA Content Localization.
