bl_info = {
    "name": "nooi.ai",
    "author": "nooi.ai",
    "version": (1, 0, 0),
    "blender": (3, 6, 0),
    "location": "3D Viewport > Sidebar > nooi",
    "description": "Import 3D assets from your nooi.ai library and send your models back to nooi.ai",
    "category": "Import-Export",
}
import bpy, json, os, tempfile, uuid, urllib.request

def _prefs():
    return bpy.context.preferences.addons[__name__].preferences

def _req(path, data=None, headers=None, method=None):
    p = _prefs()
    url = p.server.rstrip("/") + path
    h = {"Authorization": "Bearer " + p.token}
    if headers: h.update(headers)
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    with urllib.request.urlopen(r, timeout=120) as res:
        return res.read()

class NooiPrefs(bpy.types.AddonPreferences):
    bl_idname = __name__
    server: bpy.props.StringProperty(name="Server", default="https://nooi.ai")
    token: bpy.props.StringProperty(name="API token", subtype="PASSWORD")
    def draw(self, ctx):
        self.layout.prop(self, "server"); self.layout.prop(self, "token")
        self.layout.label(text="Create a token in nooi.ai > Integrations.")

class NooiAsset(bpy.types.PropertyGroup):
    title: bpy.props.StringProperty(); url: bpy.props.StringProperty(); kind: bpy.props.StringProperty()

class NOOI_UL_assets(bpy.types.UIList):
    def draw_item(self, ctx, layout, data, item, icon, active_data, active_propname):
        layout.label(text=item.title or item.url.split("/")[-1], icon="MESH_CUBE")

class NOOI_OT_refresh(bpy.types.Operator):
    bl_idname = "nooi.refresh"; bl_label = "Refresh library"
    def execute(self, ctx):
        try:
            items = json.loads(_req("/v1/assets?kind=3d")).get("assets", [])
        except Exception as e:
            self.report({"ERROR"}, f"nooi.ai: {e}"); return {"CANCELLED"}
        ctx.scene.nooi_assets.clear()
        for a in items:
            it = ctx.scene.nooi_assets.add(); it.title = a.get("title") or ""; it.url = a.get("url") or ""; it.kind = a.get("kind") or ""
        self.report({"INFO"}, f"{len(items)} assets"); return {"FINISHED"}

class NOOI_OT_import(bpy.types.Operator):
    bl_idname = "nooi.import_asset"; bl_label = "Import selected"
    def execute(self, ctx):
        s = ctx.scene
        if not s.nooi_assets: return {"CANCELLED"}
        a = s.nooi_assets[s.nooi_index]
        ext = os.path.splitext(a.url.split("?")[0])[1].lower() or ".glb"
        path = os.path.join(tempfile.gettempdir(), f"nooi_{uuid.uuid4().hex[:8]}{ext}")
        with urllib.request.urlopen(a.url, timeout=300) as r, open(path, "wb") as f: f.write(r.read())
        if ext in (".glb", ".gltf"): bpy.ops.import_scene.gltf(filepath=path)
        elif ext == ".obj":
            try: bpy.ops.wm.obj_import(filepath=path)
            except Exception: bpy.ops.import_scene.obj(filepath=path)
        elif ext == ".fbx": bpy.ops.import_scene.fbx(filepath=path)
        elif ext == ".ply":
            try: bpy.ops.wm.ply_import(filepath=path)
            except Exception: bpy.ops.import_mesh.ply(filepath=path)
        else:
            self.report({"ERROR"}, "Unsupported format " + ext); return {"CANCELLED"}
        return {"FINISHED"}

class NOOI_OT_send(bpy.types.Operator):
    bl_idname = "nooi.send_selection"; bl_label = "Send selection to nooi.ai"
    title: bpy.props.StringProperty(name="Title", default="From Blender")
    def invoke(self, ctx, ev): return ctx.window_manager.invoke_props_dialog(self)
    def execute(self, ctx):
        path = os.path.join(tempfile.gettempdir(), f"nooi_send_{uuid.uuid4().hex[:8]}.glb")
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True)
        b = uuid.uuid4().hex
        body = (f"--{b}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"blender.glb\"\r\nContent-Type: model/gltf-binary\r\n\r\n").encode() + open(path, "rb").read() + f"\r\n--{b}--\r\n".encode()
        try:
            up = json.loads(_req("/v1/uploads", body, {"Content-Type": f"multipart/form-data; boundary={b}"}, "POST"))
            _req("/v1/assets", json.dumps({"url": up["url"], "kind": "3d", "title": self.title}).encode(), {"Content-Type": "application/json"}, "POST")
        except Exception as e:
            self.report({"ERROR"}, f"nooi.ai: {e}"); return {"CANCELLED"}
        self.report({"INFO"}, "Sent to your nooi.ai library"); return {"FINISHED"}

class NOOI_PT_panel(bpy.types.Panel):
    bl_label = "nooi.ai"; bl_space_type = "VIEW_3D"; bl_region_type = "UI"; bl_category = "nooi"
    def draw(self, ctx):
        l = self.layout; s = ctx.scene
        l.operator("nooi.refresh", icon="FILE_REFRESH")
        l.template_list("NOOI_UL_assets", "", s, "nooi_assets", s, "nooi_index", rows=6)
        l.operator("nooi.import_asset", icon="IMPORT")
        l.separator(); l.operator("nooi.send_selection", icon="EXPORT")

classes = (NooiPrefs, NooiAsset, NOOI_UL_assets, NOOI_OT_refresh, NOOI_OT_import, NOOI_OT_send, NOOI_PT_panel)
def register():
    for c in classes: bpy.utils.register_class(c)
    bpy.types.Scene.nooi_assets = bpy.props.CollectionProperty(type=NooiAsset)
    bpy.types.Scene.nooi_index = bpy.props.IntProperty()
def unregister():
    del bpy.types.Scene.nooi_assets; del bpy.types.Scene.nooi_index
    for c in reversed(classes): bpy.utils.unregister_class(c)
if __name__ == "__main__": register()
