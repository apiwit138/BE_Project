const Reservation = require('../models/Reservation');
const CoworkingSpace = require('../models/CoworkingSpace');
const mongoose = require('mongoose');

//@desc     Get all reservations
//@route    GET /api/v1/reservations
//@route    GET /api/v1/coworkingspaces/:coworkingSpaceId/reservations
//@access   Private
//@desc     Get all reservations
//@route    GET /api/v1/reservations
//@access   Private
exports.getReservations = async (req, res, next) => {
  let query;

  // สร้าง Object สำหรับการ Populate เพื่อลดความซ้ำซ้อน
  const populateOption = [
    {
      path: 'coworkingSpace',
      select: 'name address telephoneNumber openTime closeTime',
    },
    {
      path: 'user',
      select: 'name email', // 🔥 เพิ่มตรงนี้เพื่อให้ส่งชื่อผู้จองกลับไปด้วย
    }
  ];

  // General users can see only their own reservations
  if (req.user.role !== 'admin') {
    query = Reservation.find({ user: req.user.id }).populate(populateOption);
  } else {
    // Admins can see all reservations, optionally filtered by coworkingSpaceId
    if (req.params.coworkingSpaceId) {
      query = Reservation.find({ coworkingSpace: req.params.coworkingSpaceId }).populate(populateOption);
    } else {
      query = Reservation.find().populate(populateOption);
    }
  }

  try {
    const reservations = await query;

    res.status(200).json({
      success: true,
      count: reservations.length,
      data: reservations,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: 'Cannot find reservations',
    });
  }
};

// อย่าลืมแก้ใน getReservation (Single) ด้วยเพื่อให้กดดูรายละเอียดแล้วเห็นชื่อ
exports.getReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id).populate([
      {
        path: 'coworkingSpace',
        select: 'name address telephoneNumber openTime closeTime',
      },
      {
        path: 'user',
        select: 'name email', // 🔥 เพิ่มตรงนี้ด้วย
      }
    ]);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: `No reservation with the id of ${req.params.id}`,
      });
    }

    if (reservation.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: `User ${req.user.id} is not authorized to view this reservation`,
      });
    }

    res.status(200).json({ success: true, data: reservation });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: 'Cannot find reservation' });
  }
};

exports.addReservation = async (req, res, next) => {
  try {
    const { reservationDate } = req.body;
    const coworkingSpaceId = req.params.coworkingSpaceId;

    if (!reservationDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide reservation date'
      });
    }

    req.body.coworkingSpace = coworkingSpaceId;
    req.body.user = req.user.id;

    const coworkingSpace = await CoworkingSpace.findById(coworkingSpaceId);
    if (!coworkingSpace) {
      return res.status(404).json({
        success: false,
        message: 'Coworking space not found'
      });
    }

    const existedReservations = await Reservation.find({ user: req.user.id });

    if (existedReservations.length >= 3 && req.user.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Maximum 3 reservations per user'
      });
    }

    const reservation = await Reservation.create({
      reservationDate,
      coworkingSpace: coworkingSpaceId,
      user: req.user.id
    });

    await reservation.populate([
      { path: 'user', select: 'name email role' },
      { path: 'coworkingSpace', select: 'name address' }
    ]);

    res.status(201).json({
      success: true,
      data: reservation
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: 'Cannot create reservation'
    });
  }
};
//@desc     Update reservation
//@route    PUT /api/v1/reservations/:id
//@access   Private
exports.updateReservation = async (req, res, next) => {
  try {
    let reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: `No reservation with the id of ${req.params.id}`,
      });
    }

    // Only owner or admin can update
    if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: `User ${req.user.id} is not authorized to update this reservation`,
      });
    }

    reservation = await Reservation.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ success: true, data: reservation });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: 'Cannot update reservation',
    });
  }
};

//@desc     Delete reservation
//@route    DELETE /api/v1/reservations/:id
//@access   Private
exports.deleteReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: `No reservation with the id of ${req.params.id}`,
      });
    }

    // Only owner or admin can delete
    if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: `User ${req.user.id} is not authorized to delete this reservation`,
      });
    }

    await reservation.deleteOne();

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: 'Cannot delete reservation',
    });
  }
};


//Checkin
exports.checkInReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({ message: "Reservation not found" });
    }

    if (reservation.status !== "BOOKED") {
      return res.status(400).json({
        message: "Cannot check in. Invalid status."
      });
    }

    reservation.status = "CHECKED_IN";
    await reservation.save();

    res.status(200).json({
      success: true,
      data: reservation
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


//checkout
exports.checkOutReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({ message: "Reservation not found" });
    }

    if (reservation.status !== "CHECKED_IN") {
      return res.status(400).json({
        message: "Cannot check out. Must check in first."
      });
    }

    reservation.status = "COMPLETED";
    await reservation.save();

    res.status(200).json({
      success: true,
      data: reservation
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
