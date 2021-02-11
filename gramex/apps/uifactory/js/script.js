/* globals user, active_form_id, _user_form_config */
/* exported editor */

let editor
const options = {}
const template = {}
$('.field-actions').template({base: '.'})

$(window).on('click', function(e) {
  if(!$(e.target).closest('.edit-properties').length && !$(e.target).closest('.user-form').length) {
    $('.edit-properties').empty()
    $('.user-form > *').removeClass('highlight')
    $('.actions').addClass('d-none')
  }
})

fetch('snippets/snippets.json')
  .then(response => response.json())
  .then(json => {
    _.each(json, (val, dir) => {
      options[dir] = val.options
      const tmpl = template[dir] = _.template(val.template)
      let vals = _.mapValues(options[dir], v => v.value)
      vals['view'] = 'default'
      $(tmpl(vals))
        .attr('data-type', dir)
        .attr('data-vals', JSON.stringify(vals))
        .appendTo('.form-fields')
    })
    $('.edit-properties-container').css('height', $(document).innerHeight())
    // TODO: Can we ensure they all have a common parent class? I'll assume it's .form-group
    $('body').on('click', '.user-form .form-group, .user-form .form-check', function () {
      $('.edit-properties').empty()
        .data('editing-element', $(this))
      $('.form-group, .form-check, button').removeClass('highlight')
      $(this).addClass('highlight')
      $('.actions').insertBefore(this)
      $('.actions').removeClass('d-none')
      let field_vals = JSON.parse($(this).attr('data-vals')) || $(this).data('vals')
      _.each(options[$(this).data('type')], function (option, key) {
        let vals
        vals = _.mapValues(options[option.field], v => v.value)
        _.extend(vals, option)
        vals.value = _user_form_config.length > 0 ? _user_form_config[key] : field_vals[key]
        vals['view'] = 'editing'
        $(template[option.field](vals))
          .appendTo('.edit-properties')
          .addClass('form-element')
          .data('key', key)
          .data('field', option.field)
      })
    })
  }).then(function() {
    // render existing form using JSON
    if(active_form_id) {
      _.each(_user_form_config, function(opts, dir) {
        _.each(opts, function(opt, ind) {
          opt['view'] = '...'
          $(template[dir](opt))
            .attr('data-type', dir)
            .attr('data-vals', JSON.stringify(opt))
            .appendTo('.user-form')
        })
      })
    }
  })

$('body').on('click', '#publish-form', function() {
  let _vals = {}
  $('.edit-properties .form-group input, .edit-properties .form-check input').each(function(ind, item) { _vals[item.id] = item.value })
  $('.user-form > *').removeClass('highlight')
  $('.edit-properties').empty()
  let $icon = $('<i class="fa fa-spinner fa-2x fa-fw align-middle"></i>').appendTo(this)

  let _md = {
    name: $('#form-name').text() || 'Untitled',
    categories: [],
    description: $('#form-description').text().trim()
  }
  let form_vals = {}
  $('.user-form .form-group, .user-form .form-check').each(function(ind, item) {
    if(typeof item !== undefined) {
      if(form_vals[$(item).attr('data-type')] === undefined) {
        form_vals[$(item).attr('data-type')] = [$(item).attr('data-vals')]
      } else {
        form_vals[$(item).attr('data-type')].push($(item).attr('data-vals'))
      }
    }
  })
  let form_details = {
    data: {
      config: JSON.stringify(form_vals),
      html: $('#user-form form').html(),
      metadata: JSON.stringify(_md),
      user: user
    }
  }

  if(active_form_id.length > 0) {
    form_details.data.id = active_form_id
    form_details.method = 'PUT'
    // update existing form
    $.ajax('publish', {
      method: 'PUT',
      data: form_details.data,
      success: function () {
        $('.post-publish').removeClass('d-none')
        $('.form-link').html(`<a href="form/${active_form_id}" target="_blank">View</a>`)
      },
      error: function () {
        $('.toast-body').html('Unable to update the form. Please try again later.')
        $('.toast').toast('show')
      },
      complete: function() { $icon.fadeOut() }
    })
  } else {
    // POST creates a new identifier
    delete form_details.data.id
    form_details.method = 'POST'
    $.ajax('publish', {
      method: form_details.method,
      data: form_details.data,
      success: function (response) {
        form_details.id = response.data.inserted[0].id
        $('.post-publish').removeClass('d-none')
        $('.form-link').html(`<a href="form/${form_details.id}" target="_blank">View</a>`)
        window.location.href = `create?id=${form_details.id}`
      },
      error: function () {
        $('.toast-body').html('Unable to publish the form. Please try again later.')
        $('.toast').toast('show')
      },
      complete: function() { $icon.fadeOut() }
    })
  }
}).on('click', '.form-fields > *', function() {
  var _type = $(this).data('type')
  let vals = _.mapValues(options[_type], v => v.value)
  vals['view'] = 'updating'
  $(`.form-fields > [data-type=${_type}]`)
    .data('type', _type)
    .data('vals', vals)
    .clone()
    .appendTo('.user-form')
  $('#publish-form').removeClass('d-none')
  $('.btn-link').removeClass('d-none')
  $('#addFieldModal').modal('hide')
}).on('click', '[data-action]', function() {
  const form_el = $(this).parent().parent().next()
  if($(this).data('action') === 'duplicate') {
    form_el.clone().appendTo('.user-form')
  } else if($(this).data('action') === 'delete') {
    form_el.remove()
  }
  $('.edit-properties').empty()
  $('.user-form > *').removeClass('highlight')
  $('.actions').addClass('d-none')
})

$('.edit-properties').on('input change', function () {
  let vals = {}
  $(':input', this).each(function () { vals[this.id] = this.value })
  var $el = $('.edit-properties').data('editing-element')
  var field = $($el).attr('data-type')
  let _v = ""
  vals['view'] = 'updating'
  // get all and stitch together
  // since radio and checkbox fields each support multiple options
  if(field === 'radio' || field === 'checkbox') {
    let tmpl_items = $(template[field](vals))
    _.each(tmpl_items, function(item) {
      if($(item).hasClass('form-check')) {
        _v += $(item).html().trim()
      }
    })
  } else {
    // $el includes outerHTML (.form-group onwards)
    // without .html(), the rendered template will contain .form-group > .form-group > input/select etc.
    // we need .form-group > input/select etc.
    _v = $(template[field](vals)).html().trim()
  }
  $el.html(_v)
    .attr('data-vals', JSON.stringify(vals))
  $('.field-actions').template({base: '.'})
  $('.actions').removeClass('d-none')
  $('.actions').insertBefore($el)
})
$('.user-form').on('submit', function(e) {
  e.preventDefault()
})
