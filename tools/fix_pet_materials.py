import bpy

for mat in bpy.data.materials:
    color = tuple(mat.diffuse_color)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial')
    shader = nodes.new('ShaderNodeBsdfPrincipled')
    shader.inputs['Base Color'].default_value = color
    shader.inputs['Roughness'].default_value = .7
    shader.inputs['Metallic'].default_value = .05
    if mat.name in {'eye', 'eye2'}:
        shader.inputs['Base Color'].default_value = (0.04, 0.08, 0.1, 1)
        shader.inputs['Emission Color'].default_value = (0.05, 0.35, 0.5, 1)
        shader.inputs['Emission Strength'].default_value = .35
        shader.inputs['Roughness'].default_value = .35
    links.new(shader.outputs['BSDF'], out.inputs['Surface'])

bpy.ops.wm.save_as_mainfile(filepath='attached_assets/DropoutBear_1785317163389.blend')
bpy.ops.export_scene.gltf(filepath='attached_assets/generated_models/dropout-bear.glb', export_format='GLB', export_apply=True, export_animations=True, export_animation_mode='ACTIONS', export_lights=False, export_cameras=False)
