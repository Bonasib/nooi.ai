# A test person as a .glb (what a 3D engine returns for "a full-body photo → 3D"): one textured mesh, 1.75 m tall, standing in an
# A-pose, facing +Z (or turned round / lying with Z up, to check that the World turns it the right way), no skeleton.
# Used by tests/v87.py to check that the World fits a skeleton to it and makes it walk, sit, wave and talk.
import json, math, struct
import numpy as np

def capsule(a, b, r, seg=12, rings=6):
    a, b = np.array(a, float), np.array(b, float); ax = b - a; L = np.linalg.norm(ax); ax /= L
    t = np.array([1.0, 0, 0]) if abs(ax[0]) < 0.9 else np.array([0, 0, 1.0]); u = np.cross(ax, t); u /= np.linalg.norm(u); w = np.cross(ax, u)
    V, F = [], []
    for i in range(rings + 1):
        p = a + ax * (L * i / rings)
        for j in range(seg):
            th = 2 * math.pi * j / seg; V.append(p + (u * math.cos(th) + w * math.sin(th)) * r)
    for i in range(rings):
        for j in range(seg):
            k0, k1 = i * seg + j, i * seg + (j + 1) % seg; F += [(k0, k0 + seg, k1), (k1, k0 + seg, k1 + seg)]
    c0, c1 = len(V), len(V) + 1; V += [a - ax * r * 0.7, b + ax * r * 0.7]
    for j in range(seg): F += [(c0, (j + 1) % seg, j), (c1, rings * seg + j, rings * seg + (j + 1) % seg)]
    return V, F

def ellipsoid(c, rx, ry, rz, seg=16, rings=10):
    V, F = [], []
    for i in range(rings + 1):
        ph = math.pi * i / rings
        for j in range(seg):
            th = 2 * math.pi * j / seg; V.append((c[0] + rx * math.sin(ph) * math.cos(th), c[1] + ry * math.cos(ph), c[2] + rz * math.sin(ph) * math.sin(th)))
    for i in range(rings):
        for j in range(seg):
            k0, k1 = i * seg + j, i * seg + (j + 1) % seg; F += [(k0, k1, k0 + seg), (k1, k1 + seg, k0 + seg)]
    return V, F

def person(H=1.75):
    s = H; parts = []
    for sg in (1, -1):
        parts.append(capsule((sg * .09 * s, .50 * s, 0), (sg * .085 * s, .28 * s, .005 * s), .062 * s))     # thigh
        parts.append(capsule((sg * .085 * s, .28 * s, .005 * s), (sg * .08 * s, .06 * s, 0), .045 * s))     # shin
        parts.append(ellipsoid((sg * .08 * s, .03 * s, .045 * s), .045 * s, .03 * s, .1 * s))              # foot (toes forward, +Z)
        sh = np.array([sg * .19 * s, .81 * s, 0]); d = np.array([sg * math.sin(math.radians(32)), -math.cos(math.radians(32)), 0])
        el, wr = sh + d * .19 * s, sh + d * .34 * s
        parts.append(capsule(sh, el, .04 * s)); parts.append(capsule(el, wr, .033 * s)); parts.append(ellipsoid(wr + d * .05 * s, .025 * s, .05 * s, .035 * s))
    parts.append(ellipsoid((0, .53 * s, 0), .15 * s, .09 * s, .1 * s))       # pelvis
    parts.append(ellipsoid((0, .70 * s, 0), .17 * s, .15 * s, .11 * s))      # chest
    parts.append(capsule((0, .80 * s, 0), (0, .86 * s, 0), .045 * s))         # neck
    parts.append(ellipsoid((0, .925 * s, .01 * s), .075 * s, .085 * s, .09 * s))   # head
    parts.append(ellipsoid((0, .925 * s, .088 * s), .015 * s, .02 * s, .02 * s))    # nose (front)
    V, F = [], []
    for v, f in parts: o = len(V); V += [tuple(x) for x in v]; F += [(a + o, b + o, c + o) for a, b, c in f]
    return np.array(V, np.float32), np.array(F, np.uint32)

def glb(path, turn=0, zup=False):
    V, F = person()
    if turn: V[:, 0] *= -1; V[:, 2] *= -1        # turned round (facing -Z)
    if zup: V = V[:, [0, 2, 1]] * np.array([1, -1, 1], np.float32)   # lying in a Z-up file
    V = V.astype(np.float32)
    # texture: skin above the neck, a shirt, trousers (a 4×4 PNG made by hand) — uv by height
    uv = np.stack([np.full(len(V), .5, np.float32), (1 - (V[:, 2] if zup else V[:, 1]) / 1.75).astype(np.float32)], 1)
    import zlib
    def png(rows):
        raw = b"".join(b"\0" + bytes(sum(rows[y], [])) for y in range(len(rows))); h = len(rows); w = len(rows[0])
        def ch(t, d): c = struct.pack(">I", len(d)) + t + d; return c + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
        return b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + ch(b"IDAT", zlib.compress(raw)) + ch(b"IEND", b"")
    skin, shirt, pants = [206, 160, 128], [240, 240, 236], [40, 52, 80]
    img = png([[skin] * 4, [shirt] * 4, [pants] * 4, [pants] * 4])
    pos, ind, uvb = V.tobytes(), F.astype(np.uint32).tobytes(), uv.tobytes()
    def pad(b): return b + b"\0" * ((4 - len(b) % 4) % 4)
    blobs = [pad(pos), pad(uvb), pad(ind), pad(img)]; offs = np.cumsum([0] + [len(b) for b in blobs[:-1]]).tolist()
    js = {"asset": {"version": "2.0"}, "scenes": [{"nodes": [0]}], "scene": 0, "nodes": [{"mesh": 0, "name": "person"}],
          "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "TEXCOORD_0": 1}, "indices": 2, "material": 0}]}],
          "materials": [{"pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0, "roughnessFactor": .8}}],
          "textures": [{"source": 0, "sampler": 0}], "samplers": [{"magFilter": 9728, "minFilter": 9728}], "images": [{"bufferView": 3, "mimeType": "image/png"}],
          "buffers": [{"byteLength": sum(len(b) for b in blobs)}],
          "bufferViews": [{"buffer": 0, "byteOffset": offs[0], "byteLength": len(pos)}, {"buffer": 0, "byteOffset": offs[1], "byteLength": len(uvb)}, {"buffer": 0, "byteOffset": offs[2], "byteLength": len(ind)}, {"buffer": 0, "byteOffset": offs[3], "byteLength": len(img)}],
          "accessors": [{"bufferView": 0, "componentType": 5126, "count": len(V), "type": "VEC3", "min": V.min(0).tolist(), "max": V.max(0).tolist()},
                        {"bufferView": 1, "componentType": 5126, "count": len(V), "type": "VEC2"},
                        {"bufferView": 2, "componentType": 5125, "count": int(F.size), "type": "SCALAR"}]}
    j = json.dumps(js).encode(); j += b" " * ((4 - len(j) % 4) % 4); binb = b"".join(blobs)
    body = struct.pack("<II", len(j), 0x4E4F534A) + j + struct.pack("<II", len(binb), 0x004E4942) + binb
    open(path, "wb").write(struct.pack("<III", 0x46546C67, 2, 12 + len(body)) + body)

if __name__ == "__main__":
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else "person.glb"
    glb(out); glb(out.replace(".glb", "-turned.glb"), turn=1); glb(out.replace(".glb", "-zup.glb"), zup=True); print("ok", out)
