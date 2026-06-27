const Blog = require('../../models/Blog');

// GET /api/admin/blogs
const getAllBlogs = async (req, res) => {
  try {
    const { isPublished, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (isPublished !== undefined) filter.isPublished = isPublished === 'true';

    const total = await Blog.countDocuments(filter);
    const blogs = await Blog.find(filter)
      .select('title slug isPublished publishedAt views tags author createdAt')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    return res.json({ success: true, data: blogs, total });
  } catch (error) {
    console.error('admin getAllBlogs error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch blogs' });
  }
};

// GET /api/admin/blogs/:id
const getBlogById = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    return res.json({ success: true, data: blog });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch blog' });
  }
};

// POST /api/admin/blogs
const createBlog = async (req, res) => {
  try {
    const { title, slug: customSlug, ...rest } = req.body;
    const slug = customSlug ||
      title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') +
      '-' + Date.now().toString().slice(-4);

    const coverImage = req.file?.location || (req.file ? `/uploads/${req.file.filename}` : rest.coverImage);

    const blog = await Blog.create({ title, slug, ...rest, coverImage });
    return res.status(201).json({ success: true, data: blog });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Blog slug already exists' });
    }
    console.error('admin createBlog error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create blog' });
  }
};

// PUT /api/admin/blogs/:id
const updateBlog = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (req.file) {
      updates.coverImage = req.file.location || `/uploads/${req.file.filename}`;
    }

    const blog = await Blog.findByIdAndUpdate(req.params.id, updates, {
      new: true, runValidators: true,
    });
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    return res.json({ success: true, data: blog });
  } catch (error) {
    console.error('admin updateBlog error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update blog' });
  }
};

// DELETE /api/admin/blogs/:id
const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    return res.json({ success: true, message: 'Blog deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete blog' });
  }
};

// PATCH /api/admin/blogs/:id/publish
const togglePublish = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });

    blog.isPublished = !blog.isPublished;
    if (blog.isPublished && !blog.publishedAt) {
      blog.publishedAt = new Date();
    }
    await blog.save();

    return res.json({
      success: true,
      data: { _id: blog._id, isPublished: blog.isPublished },
      message: `Blog ${blog.isPublished ? 'published' : 'unpublished'}`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to toggle publish status' });
  }
};

module.exports = { getAllBlogs, getBlogById, createBlog, updateBlog, deleteBlog, togglePublish };
