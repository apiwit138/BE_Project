const express = require('express');
const {
  getReviews,
  getReview,
  createReview,
  updateReview,
  deleteReview,
  getReviewsByCoworking
} = require('../controllers/reviews');

const router = express.Router({ mergeParams: true });
const { protect, authorize } = require('../middleware/auth');

// 🔹 เส้นทางหลัก /api/v1/reviews
router.route('/')
  .get(getReviews) // ใครก็ดูรีวิวทั้งหมดได้
  .post(protect, authorize('user', 'admin'), createReview); // ต้องล็อกอินถึงจะรีวิวได้

// 🔹 เส้นทางที่มีการระบุ ID /api/v1/reviews/:id
router.route('/:id')
  .get(getReview)
  .put(protect, authorize('user', 'admin'), updateReview)
  .delete(protect, authorize('user', 'admin'), deleteReview);

// 🔹 เส้นทางดูรีวิวตามสถานที่ /api/v1/reviews/coworking/:coworkingId
router.route('/coworking/:coworkingId')
  .get(getReviewsByCoworking);

module.exports = router;