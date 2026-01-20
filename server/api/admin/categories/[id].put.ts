import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'

export default defineEventHandler(async (event) => {
  try {
    const categoryId = getRouterParam(event, 'id')
    const body = await readBody<{
      clerk_id: string
      name?: string
      description?: string
      order?: number
      default_elo?: number
    }>(event)

    const { clerk_id, name, description, order, default_elo } = body

    if (!categoryId || !clerk_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: category_id, clerk_id'
      })
    }

    await requireAdmin(clerk_id)

    const supabase = getSupabaseAdmin()

    // Check if category exists
    const { data: existingCategory, error: fetchError } = await supabase
      .from('categories')
      .select('id, name')
      .eq('id', categoryId)
      .single()

    if (fetchError || !existingCategory) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Category not found'
      })
    }

    // If name is being changed, check if new name already exists
    if (name && name.trim() !== existingCategory.name) {
      const { data: nameConflict } = await supabase
        .from('categories')
        .select('id')
        .eq('name', name.trim())
        .neq('id', categoryId)
        .single()

      if (nameConflict) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Category with this name already exists'
        })
      }
    }

    // Build update object
    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (order !== undefined) updateData.order = order
    if (default_elo !== undefined) updateData.default_elo = default_elo

    const { data: category, error: updateError } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', categoryId)
      .select()
      .single()

    if (updateError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to update category',
        data: updateError
      })
    }

    return {
      success: true,
      message: 'Category updated successfully',
      category
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})




