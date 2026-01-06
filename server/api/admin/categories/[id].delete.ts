import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'

export default defineEventHandler(async (event) => {
  try {
    const categoryId = getRouterParam(event, 'id')
    const body = await readBody<{ clerk_id: string }>(event)
    const { clerk_id } = body

    if (!categoryId || !clerk_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: category_id, clerk_id'
      })
    }

    await requireAdmin(clerk_id)

    const supabase = getSupabaseAdmin()

    // Check if category exists
    const { data: category, error: fetchError } = await supabase
      .from('categories')
      .select('id, name')
      .eq('id', categoryId)
      .single()

    if (fetchError || !category) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Category not found'
      })
    }

    // Check if any players are using this category
    const { data: playersUsingCategory, error: playersError } = await supabase
      .from('players')
      .select('id')
      .eq('category_id', categoryId)
      .eq('status', 'active')
      .limit(1)

    if (playersError) {
      console.error('Error checking players:', playersError)
    }

    if (playersUsingCategory && playersUsingCategory.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot delete category: There are active players using this category'
      })
    }

    // Delete the category
    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId)

    if (deleteError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to delete category',
        data: deleteError
      })
    }

    return {
      success: true,
      message: `Category "${category.name}" has been deleted successfully`,
      deletedCategory: {
        id: category.id,
        name: category.name
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})




