import bpy
from mathutils import Euler

armature = bpy.data.objects.get("Dropoutbear")
if not armature or armature.type != "ARMATURE":
    raise RuntimeError("Dropoutbear armature was not found")

for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)

def make_action(name, length, poses):
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    for frame, pose in poses:
        for bone_name, values in pose.items():
            bone = armature.pose.bones.get(bone_name)
            if not bone:
                continue
            bone.rotation_mode = "XYZ"
            bone.rotation_euler = Euler(values, "XYZ")
            bone.keyframe_insert("rotation_euler", frame=frame, group=bone_name)
    for fc in action.fcurves:
        for key in fc.keyframe_points:
            key.interpolation = "BEZIER"
    return action

zero = (0.0, 0.0, 0.0)
idle = make_action("Idle", 48, [
    (1, {"spine": zero, "head": zero, "upper_arm.L": zero, "upper_arm.R": zero}),
    (24, {"spine": (0.0, 0.025, 0.0), "head": (0.0, -0.025, 0.0), "upper_arm.L": (0.0, 0.0, -0.035), "upper_arm.R": (0.0, 0.0, 0.035)}),
    (48, {"spine": zero, "head": zero, "upper_arm.L": zero, "upper_arm.R": zero}),
])
eat = make_action("Eat", 36, [
    (1, {"head": zero, "spine": zero}),
    (8, {"head": (0.28, 0.0, 0.0), "spine": (0.08, 0.0, 0.0)}),
    (16, {"head": (0.05, 0.0, 0.0), "spine": (0.0, 0.0, 0.0)}),
    (24, {"head": (0.28, 0.0, 0.0), "spine": (0.08, 0.0, 0.0)}),
    (36, {"head": zero, "spine": zero}),
])
play = make_action("Play", 48, [
    (1, {"upper_arm.L": (0.0, 0.0, -0.25), "upper_arm.R": (0.0, 0.0, 0.25), "head": zero}),
    (12, {"upper_arm.L": (0.0, 0.0, 0.25), "upper_arm.R": (0.0, 0.0, -0.25), "head": (0.0, 0.0, 0.08)}),
    (24, {"upper_arm.L": (0.0, 0.0, -0.25), "upper_arm.R": (0.0, 0.0, 0.25), "head": (0.0, 0.0, -0.08)}),
    (36, {"upper_arm.L": (0.0, 0.0, 0.25), "upper_arm.R": (0.0, 0.0, -0.25), "head": (0.0, 0.0, 0.08)}),
    (48, {"upper_arm.L": zero, "upper_arm.R": zero, "head": zero}),
])
sleep = make_action("Sleep", 48, [
    (1, {"spine": zero, "head": zero, "neck": zero}),
    (18, {"spine": (0.0, 0.0, -0.2), "head": (0.35, 0.0, -0.15), "neck": (0.15, 0.0, 0.0)}),
    (36, {"spine": (0.0, 0.0, -0.2), "head": (0.35, 0.0, -0.15), "neck": (0.15, 0.0, 0.0)}),
    (48, {"spine": zero, "head": zero, "neck": zero}),
])

for action in (idle, eat, play, sleep):
    action_frame_end = max((kp.co[0] for fc in action.fcurves for kp in fc.keyframe_points), default=48)
    action.frame_range = (1, action_frame_end)

armature.animation_data_create()
armature.animation_data.action = idle

bpy.ops.wm.save_as_mainfile(filepath="attached_assets/DropoutBear_1785317163389.blend")
bpy.ops.export_scene.gltf(
    filepath="attached_assets/generated_models/dropout-bear.glb",
    export_format="GLB",
    export_apply=True,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_lights=False,
    export_cameras=False,
)