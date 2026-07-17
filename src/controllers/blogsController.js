const Blog = require('../models/Blog');

// GET /api/blogs
const getBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, tag } = req.query;
    const filter = { isPublished: true, isDeleted: { $ne: true } };
    if (tag) filter.tags = tag;

    const total = await Blog.countDocuments(filter);
    const blogs = await Blog.find(filter)
      .select('title slug excerpt coverImage tags author readTime views publishedAt')
      .sort({ publishedAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    return res.json({
      success: true,
      data: blogs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('getBlogs error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch blogs' });
  }
};

// GET /api/blogs/:slug
const getBlogBySlug = async (req, res) => {
  try {
    const blog = await Blog.findOneAndUpdate(
      { slug: req.params.slug, isPublished: true, isDeleted: { $ne: true } },
      { $inc: { views: 1 } },
      { new: true }
    );

    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }

    return res.json({ success: true, data: blog });
  } catch (error) {
    console.error('getBlogBySlug error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch blog' });
  }
};

module.exports = { getBlogs, getBlogBySlug };
