import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const body = await readBody<{
      name: string
      description?: string
      order?: number
      default_elo?: number
    }>(event)

    const { name, description, order, default_elo } = body

    if (!name || name.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Category name is required'
      })
    }

    const supabase = getSupabaseAdmin()

    // Check if category with same name already exists
    const { data: existingCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('name', name.trim())
      .single()

    if (existingCategory) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Category with this name already exists'
      })
    }

    // Get max order if not provided
    let categoryOrder = order
    if (categoryOrder === undefined || categoryOrder === null) {
      const { data: maxOrderResult } = await supabase
        .from('categories')
        .select('order')
        .order('order', { ascending: false })
        .limit(1)
        .single()

      categoryOrder = maxOrderResult ? (maxOrderResult.order as number) + 1 : 0
    }

    // Calculate default_elo based on order if not provided
    // Formula: 2500 - ((order - 1) * 250) for categories 1-7
    const defaultEloValue = default_elo !== undefined 
      ? default_elo 
      : Math.max(1000, 2500 - ((categoryOrder - 1) * 250))

    const { data: category, error: insertError } = await supabase
      .from('categories')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        order: categoryOrder,
        default_elo: defaultEloValue
      })
      .select()
      .single()

    if (insertError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create category',
        data: insertError
      })
    }

    return {
      success: true,
      message: 'Category created successfully',
      category
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})




