module.exports = {
    mainMenu: {
        reply_markup: {
            keyboard: [
                ['📚 Kurslar', '📖 Kitoblar'],
                ['🎥 Video kurslar', '🎓 Mening kurslarim'],
                ['⚙️ Sozlamalar']
            ],
            resize_keyboard: true
        }
    },

    coursesMenu: (courses) => {
        const buttons = courses.map(course => [{
            text: course.title,
            callback_data: `course_${course.id}`
        }]);
        buttons.push([{ text: '◀️ Orqaga', callback_data: 'back_main' }]);

        return {
            reply_markup: {
                inline_keyboard: buttons
            }
        };
    },

    courseDetail: (courseId) => ({
        reply_markup: {
            inline_keyboard: [
                [{ text: '💳 Sotib olish', callback_data: `buy_${courseId}` }],
                [{ text: '◀️ Orqaga', callback_data: 'back_courses' }]
            ]
        }
    }),

    paymentTypes: (courseId, course) => {
        const buttons = [];

        if (course.price_full && course.price_full > 0) {
            buttons.push([{
                text: `To'liq kurs - ${course.price_full.toLocaleString()} so'm`,
                callback_data: `pay_full_${courseId}`
            }]);
        }

        if (course.price_monthly && course.price_monthly > 0) {
            buttons.push([{
                text: `Oylik to'lov - ${course.price_monthly.toLocaleString()} so'm/oy`,
                callback_data: `pay_monthly_${courseId}`
            }]);
        }

        if (course.price_single && course.price_single > 0 && course.type !== 'course') {
            buttons.push([{
                text: `Bir martalik - ${course.price_single.toLocaleString()} so'm`,
                callback_data: `pay_single_${courseId}`
            }]);
        }

        buttons.push([{ text: '◀️ Orqaga', callback_data: `course_${courseId}` }]);

        return {
            reply_markup: {
                inline_keyboard: buttons
            }
        };
    },

    settingsMenu: {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🔔 Bildirishnomalar', callback_data: 'toggle_notifications' }],
                [{ text: '◀️ Orqaga', callback_data: 'back_main' }]
            ]
        }
    },

    myCoursesList: (purchases) => {
        const buttons = purchases.map(p => {
            const icon = p.type === 'course' ? '📚' : p.type === 'book' ? '📖' : '🎥';
            const text = `${icon} ${p.title}${p.expiryInfo || ''}`;

            return [{
                text: text,
                callback_data: `mycourse_${p.course_id}`
            }];
        });

        buttons.push([{ text: '◀️ Orqaga', callback_data: 'back_main' }]);

        return {
            reply_markup: {
                inline_keyboard: buttons
            }
        };
    }
};