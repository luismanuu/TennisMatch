import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{
      clerk_id: string
      name: string
      description?: string
      order?: number
    }>(event)

    const { clerk_id, name, description, order } = body

    if (!clerk_id) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }

    if (!name || name.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Category name is required'
      })
    }

    await requireAdmin(clerk_id)

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

    const { data: category, error: insertError } = await supabase
      .from('categories')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        order: categoryOrder
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




