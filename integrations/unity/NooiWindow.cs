// nooi.ai for Unity — put this file in Assets/Editor/.  Menu: Window > nooi.ai
// GLB/glTF import needs the glTFast package (com.unity.cloud.gltfast) from the Package Manager.
#if UNITY_EDITOR
using System; using System.IO; using System.Collections.Generic;
using UnityEditor; using UnityEngine; using UnityEngine.Networking;

public class NooiWindow : EditorWindow {
  [Serializable] class Asset { public string id; public string title; public string url; public string kind; }
  [Serializable] class AssetList { public Asset[] assets; }
  string server, token; Asset[] assets = new Asset[0]; Vector2 scroll; string status = "";
  UnityWebRequestAsyncOperation op; Action<UnityWebRequest> onDone;

  [MenuItem("Window/nooi.ai")] static void Open() => GetWindow<NooiWindow>("nooi.ai");
  void OnEnable() { server = EditorPrefs.GetString("nooi.server", "https://nooi.ai"); token = EditorPrefs.GetString("nooi.token", ""); }

  void OnGUI() {
    EditorGUILayout.LabelField("nooi.ai library", EditorStyles.boldLabel);
    server = EditorGUILayout.TextField("Server", server);
    token = EditorGUILayout.PasswordField("API token", token);
    if (GUI.changed) { EditorPrefs.SetString("nooi.server", server); EditorPrefs.SetString("nooi.token", token); }
    using (new EditorGUI.DisabledScope(op != null)) {
      if (GUILayout.Button("Refresh 3D assets")) Get("/v1/assets?kind=3d", r => { assets = JsonUtility.FromJson<AssetList>(r.downloadHandler.text).assets ?? new Asset[0]; status = assets.Length + " assets"; });
    }
    scroll = EditorGUILayout.BeginScrollView(scroll);
    foreach (var a in assets) {
      EditorGUILayout.BeginHorizontal();
      EditorGUILayout.LabelField(string.IsNullOrEmpty(a.title) ? a.id : a.title);
      if (GUILayout.Button("Import", GUILayout.Width(70))) Download(a);
      EditorGUILayout.EndHorizontal();
    }
    EditorGUILayout.EndScrollView();
    EditorGUILayout.HelpBox(status == "" ? "Create a token in nooi.ai > Integrations." : status, MessageType.None);
  }

  void Get(string path, Action<UnityWebRequest> done) {
    var r = UnityWebRequest.Get(server.TrimEnd('/') + path);
    r.SetRequestHeader("Authorization", "Bearer " + token);
    Send(r, done);
  }
  void Download(Asset a) {
    var ext = Path.GetExtension(new Uri(a.url).AbsolutePath); if (string.IsNullOrEmpty(ext)) ext = ".glb";
    var dir = "Assets/nooi"; Directory.CreateDirectory(dir);
    var safe = string.Join("_", (string.IsNullOrEmpty(a.title) ? a.id : a.title).Split(Path.GetInvalidFileNameChars()));
    var path = Path.Combine(dir, safe + ext);
    var r = UnityWebRequest.Get(a.url); r.downloadHandler = new DownloadHandlerFile(path);
    status = "Downloading " + safe + "…";
    Send(r, _ => { AssetDatabase.Refresh(); status = "Imported to " + path; });
  }
  void Send(UnityWebRequest r, Action<UnityWebRequest> done) { onDone = done; op = r.SendWebRequest(); EditorApplication.update += Poll; }
  void Poll() {
    if (op == null || !op.isDone) return;
    EditorApplication.update -= Poll; var r = op.webRequest; op = null;
    if (r.result != UnityWebRequest.Result.Success) status = "Error: " + r.error; else onDone?.Invoke(r);
    r.Dispose(); Repaint();
  }
}
#endif
