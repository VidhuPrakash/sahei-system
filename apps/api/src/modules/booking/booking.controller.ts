import { BadRequestException, Body, Controller, Headers, Post, UseGuards } from "@nestjs/common";
import { ApiKeyGuard } from "./api-key.guard.js";
import { BookingService } from "./booking.service.js";
import { BookAppointmentDto } from "./dto/book-appointment.dto.js";
import { CancelBookingDto } from "./dto/cancel-booking.dto.js";
import { CheckAvailabilityDto } from "./dto/check-availability.dto.js";
import { LogInquiryDto } from "./dto/log-inquiry.dto.js";

@Controller("booking")
@UseGuards(ApiKeyGuard)
export class BookingController {
  constructor(private readonly booking: BookingService) {}

  @Post("check-availability")
  checkAvailability(@Body() dto: CheckAvailabilityDto) {
    return this.booking.checkAvailability(dto);
  }

  @Post("book-appointment")
  bookAppointment(
    @Body() dto: BookAppointmentDto,
    @Headers("x-customer-phone") customerPhone: string,
  ) {
    if (!customerPhone) {
      throw new BadRequestException("x-customer-phone header is required");
    }
    return this.booking.bookAppointment(dto, customerPhone);
  }

  @Post("log-inquiry")
  logInquiry(@Body() dto: LogInquiryDto) {
    return this.booking.logInquiry(dto);
  }

  @Post("cancel")
  cancelBooking(@Body() dto: CancelBookingDto) {
    return this.booking.cancelBooking(dto);
  }
}
