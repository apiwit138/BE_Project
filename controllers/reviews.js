const Review = require("../models/Review");
const Reservation = require("../models/Reservation");

// CREATE REVIEW
exports.createReview = async (req, res) => {
  try {
    const { reservationId, rating, comment } = req.body;

    const reservation = await Reservation.findById(reservationId);

    if (!reservation) {
      return res.status(404).json({ message: "Reservation not found" });
    }

    // ป้องกันรีวิวก่อนใช้งาน
    if (reservation.status !== "COMPLETED") {
      return res.status(400).json({
        message: "You can review only after completion"
      });
    }

    const review = await Review.create({
      user: req.user.id,
      coworkingSpace: reservation.coworkingSpace,
      reservation: reservationId,
      rating,
      comment
    });

    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// GET REVIEWS BY COWORKING
exports.getReviewsByCoworking = async (req, res) => {
  try {
    const reviews = await Review.find({
      coworkingSpace: req.params.coworkingId
    }).populate("user", "name");

    res.status(200).json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// DELETE REVIEW (admin only)
exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    await review.deleteOne();

    res.status(200).json({ message: "Review deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// GET ALL REVIEWS (ดึงรีวิวทั้งหมดในระบบ สำหรับหน้า All Reviews)
exports.getReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate({
        path: "coworkingSpace",
        select: "name" // ดึงชื่อสถานที่มาโชว์ด้วย
      })
      .populate({
        path: "user",
        select: "name" // ดึงชื่อคนรีวิวมาด้วย
      });

    // ส่งกลับไปเป็น format { success: true, data: [...] } เพื่อให้ Frontend เอาไป map ได้
    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET SINGLE REVIEW (ดึงรีวิวแค่ใบเดียว ตาม ID)
exports.getReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate("coworkingSpace", "name")
      .populate("user", "name");

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.status(200).json({
      success: true,
      data: review
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE REVIEW (ให้ User แก้ไขรีวิวของตัวเองได้)
exports.updateReview = async (req, res) => {
  try {
    let review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // เช็คสิทธิ์: คนแก้ต้องเป็นเจ้าของรีวิว หรือเป็น Admin
    if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ message: "Not authorized to update this review" });
    }

    review = await Review.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: review
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};