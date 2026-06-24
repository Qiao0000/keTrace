{
  "targets": [
    {
      "target_name": "ctrl_monitor",
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "sources": ["ctrl_monitor.mm"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": ["NAPI_CPP_EXCEPTIONS"],
      "conditions": [
        ["OS=='mac'", {
          "xcode_settings": {
            "OTHER_LDFLAGS": [
              "-framework CoreGraphics",
              "-framework ApplicationServices"
            ],
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
            "MACOSX_DEPLOYMENT_TARGET": "11.0"
          }
        }]
      ]
    }
  ]
}
